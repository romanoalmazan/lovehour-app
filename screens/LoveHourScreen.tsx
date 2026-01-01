import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Dimensions,
  RefreshControl,
  Modal,
  Pressable,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { 
  uploadUserImage, 
  getUserData, 
  verifyMutualMatch, 
  subscribeToUserPhotos, 
  subscribeToUserData,
  canUploadInCurrentHour,
  updateLastUploadHour,
  sendGoodnightUpdate,
  sendGoodmorningUpdate,
  getCurrentHourWindow,
  getTimeUntilNextHour,
  deleteUserPhoto,
  Photo 
} from '../services/userService';
import {
  initializeNotifications,
  updateNotificationSchedule,
  checkAndNotifyPartnerUpdate,
  resetNotifications
} from '../services/notificationService';

const { width } = Dimensions.get('window');
// Calculate photo size for 3-column grid
// Container padding: 24px left + 24px right = 48px
// Margins: 5px between each item (2 gaps for 3 items = 10px)
// Date section padding: 5px left (from paddingLeft: 5 in dateSectionHeader)
// Available width: width - 48 - 5 = width - 53
// Each photo: (available_width - 2 * margin) / 3
// margin = 5px between items, so 2 margins for 3 items = 10px
// PHOTO_SIZE = (width - 53 - 10) / 3 = (width - 63) / 3
const PHOTO_SIZE = Math.floor((width - 63) / 3);

type TabType = 'your' | 'partner';

// Helper functions - defined outside component
const formatDateHeader = (date: Date): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  
  if (compareDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (compareDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
};

const groupPhotosByDate = (photos: Photo[]): Array<{ label: string; photos: Photo[]; dateKey: string }> => {
  const groups: { [key: string]: Photo[] } = {};
  
  photos.forEach((photo) => {
    if (!photo.createdAt) return;
    
    // Convert Firestore timestamp to Date
    const photoDate = photo.createdAt.toDate ? photo.createdAt.toDate() : new Date(photo.createdAt);
    
    // Use local date (not UTC) to ensure correct date grouping
    const year = photoDate.getFullYear();
    const month = String(photoDate.getMonth() + 1).padStart(2, '0');
    const day = String(photoDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`; // YYYY-MM-DD format using local date
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(photo);
  });
  
  // Convert to array and sort by date (newest first)
  // Use Set to ensure unique dateKeys before mapping
  const uniqueDateKeys = Array.from(new Set(Object.keys(groups)));
  const sortedGroups = uniqueDateKeys
    .map((dateKey) => {
      // Parse dateKey as local date, not UTC
      const [year, month, day] = dateKey.split('-').map(Number);
      const photoDate = new Date(year, month - 1, day); // month is 0-indexed
      return {
        label: formatDateHeader(photoDate),
        photos: groups[dateKey],
        dateKey,
        sortKey: photoDate.getTime(),
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ label, photos, dateKey }) => ({ label, photos, dateKey }));
  
  return sortedGroups;
};

// Memoized PhotoItem component - defined outside to prevent recreation
const PhotoItem = memo(({ photo, onPress, onError }: {
  photo: Photo;
  onPress: () => void;
  onError: () => void;
}) => (
  <TouchableOpacity
    style={styles.photoItem}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Image 
      source={{ uri: photo.url }} 
      style={styles.photoImage}
      onError={onError}
    />
  </TouchableOpacity>
), (prevProps, nextProps) => {
  // Only re-render if photo ID or URL changes
  return prevProps.photo.id === nextProps.photo.id && 
         prevProps.photo.url === nextProps.photo.url;
});

// PhotoGallery component - defined outside to prevent recreation
const PhotoGallery = memo(({ 
  photos, 
  showUploadButton, 
  brokenImageIdsArray, 
  activeTab, 
  canUpload, 
  onPickImage, 
  onImagePress, 
  onImageError,
  loadingPhotos 
}: {
  photos: Photo[];
  showUploadButton?: boolean;
  brokenImageIdsArray: string[]; // Use array instead of Set for stable comparison
  activeTab: TabType;
  canUpload: boolean;
  onPickImage: (type: 'regular' | 'goodnight' | 'goodmorning') => void;
  onImagePress: (photo: Photo) => void;
  onImageError: (photo: Photo) => void;
  loadingPhotos: boolean;
}) => {
  // ALL HOOKS MUST BE CALLED FIRST - before any conditional returns
  // Convert array back to Set for filtering
  const brokenImageIdsSet = useMemo(() => new Set(brokenImageIdsArray), [brokenImageIdsArray]);

  // Memoize filtered photos to prevent recalculation on every render
  const validPhotos = useMemo(() => 
    photos.filter(photo => !photo.id || !brokenImageIdsSet.has(photo.id)),
    [photos, brokenImageIdsSet]
  );

  // Memoize date groups to prevent recalculation
  const dateGroups = useMemo(() => groupPhotosByDate(validPhotos), [validPhotos]);
  
  // Ensure "Today" section exists if upload button should be shown
  const todayLabel = 'Today';
  const todayGroupIndex = dateGroups.findIndex(group => group.label === todayLabel);
  
  const finalDateGroups = useMemo(() => {
    if (showUploadButton && todayGroupIndex === -1) {
      // Create empty "Today" section if it doesn't exist
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayDateKey = `${year}-${month}-${day}`;
      
      return [{
        label: todayLabel,
        photos: [],
        dateKey: todayDateKey,
      }, ...dateGroups];
    }
    return dateGroups;
  }, [dateGroups, showUploadButton, todayGroupIndex]);

  // Render a section with photos in 3-column grid
  const renderPhotoGrid = useCallback((sectionPhotos: Photo[]) => {
    return sectionPhotos.map((photo, index) => (
      <PhotoItem
        key={photo.id || `${photo.url}-${index}`}
        photo={photo}
        onPress={() => onImagePress(photo)}
        onError={() => onImageError(photo)}
      />
    ));
  }, [onImagePress, onImageError]);

  // NOW we can do conditional returns after all hooks are called
  if (loadingPhotos) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#D4A574" />
        <Text style={styles.emptyText}>Loading photos...</Text>
      </View>
    );
  }

  // Check if we have any photos or sections
  const hasPhotos = validPhotos.length > 0;
  const hasSections = finalDateGroups.length > 0;

  if (!hasPhotos && !showUploadButton) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {activeTab === 'your' 
            ? "You haven't uploaded any photos yet" 
            : "Your partner hasn't uploaded any photos yet"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.galleryContainer}>
      {finalDateGroups.map((group, groupIndex) => (
        <View key={`date-section-${activeTab}-${groupIndex}-${group.dateKey}`} style={styles.dateSection}>
          <Text style={styles.dateSectionHeader}>{group.label}</Text>
          <View style={styles.photoGrid}>
            {/* Add upload button in "Today" section if needed */}
            {showUploadButton && group.label === todayLabel && (
              <TouchableOpacity
                style={[styles.uploadButtonItem, !canUpload && styles.uploadButtonItemDisabled]}
                onPress={() => onPickImage('regular')}
                activeOpacity={0.8}
                disabled={!canUpload}
              >
                <View style={styles.uploadButtonContent}>
                  <Text style={styles.uploadButtonIcon}>+</Text>
                  <Text style={styles.uploadButtonText}>Send Update</Text>
                </View>
              </TouchableOpacity>
            )}
            {/* Render photos in this section */}
            {renderPhotoGrid(group.photos)}
          </View>
        </View>
      ))}
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  if (prevProps.loadingPhotos !== nextProps.loadingPhotos) return false;
  if (prevProps.photos.length !== nextProps.photos.length) return false;
  if (prevProps.brokenImageIdsArray.length !== nextProps.brokenImageIdsArray.length) return false;
  if (prevProps.showUploadButton !== nextProps.showUploadButton) return false;
  if (prevProps.activeTab !== nextProps.activeTab) return false;
  if (prevProps.canUpload !== nextProps.canUpload) return false;
  
  // Check if photos array actually changed
  const prevPhotoIds = prevProps.photos.map(p => p.id).join(',');
  const nextPhotoIds = nextProps.photos.map(p => p.id).join(',');
  if (prevPhotoIds !== nextPhotoIds) return false;
  
  // Check if brokenImageIds changed (compare sorted arrays)
  const prevBroken = [...prevProps.brokenImageIdsArray].sort().join(',');
  const nextBroken = [...nextProps.brokenImageIdsArray].sort().join(',');
  if (prevBroken !== nextBroken) return false;
  
  return true; // Props are equal, skip re-render
});

const LoveHourScreen: React.FC = () => {
  const { user, signOut } = useAuth();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  
  // Photo gallery state
  const [activeTab, setActiveTab] = useState<TabType>('your');
  const [userPhotos, setUserPhotos] = useState<Photo[]>([]);
  const [partnerPhotos, setPartnerPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Gallery modal state
  const [galleryModalVisible, setGalleryModalVisible] = useState(false);
  const [galleryActiveTab, setGalleryActiveTab] = useState<TabType>('your');
  
  // Track broken images (images that fail to load) - use array for stable reference
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());
  const brokenImageIdsArray = useMemo(() => Array.from(brokenImageIds), [brokenImageIds]);
  
  // Image viewer modal state
  const [viewingImage, setViewingImage] = useState<Photo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  
  // Upload modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadType, setUploadType] = useState<'regular' | 'goodnight' | 'goodmorning'>('regular');

  // Hourly upload system state
  const [isAwake, setIsAwake] = useState<boolean | null>(null);
  const [canUpload, setCanUpload] = useState(true);
  const [timeUntilNextHour, setTimeUntilNextHour] = useState(0);
  const [uploadRestrictionReason, setUploadRestrictionReason] = useState<string | null>(null);
  
  // Partner data for notifications
  const [partnerName, setPartnerName] = useState<string | undefined>(undefined);

  // Set up real-time photo subscriptions
  useEffect(() => {
    if (!user) return;

    let unsubscribeUserPhotos: (() => void) | null = null;
    let unsubscribePartnerPhotos: (() => void) | null = null;

    const setupPhotoSubscriptions = async () => {
      try {
        setLoadingPhotos(true);
        
        // Subscribe to current user's photos with real-time updates
        unsubscribeUserPhotos = subscribeToUserPhotos(user.uid, (photos) => {
          setUserPhotos(photos);
          setLoadingPhotos(false);
          setRefreshing(false);
        });

        // Subscribe to partner's photos if matched
        const verification = await verifyMutualMatch(user.uid);
        if (verification.isValid && verification.partnerData) {
          // Store partner name for notifications
          const partnerNameForNotifications = verification.partnerData.fullName || verification.partnerData.displayName;
          setPartnerName(partnerNameForNotifications);
          
          const userData = await getUserData(user.uid);
          if (userData?.matchedWith) {
            unsubscribePartnerPhotos = subscribeToUserPhotos(userData.matchedWith, (photos) => {
              setPartnerPhotos(photos);
              // Check for new partner photos and send notification
              checkAndNotifyPartnerUpdate(photos.length, partnerNameForNotifications);
            });
          } else {
            setPartnerPhotos([]);
            setPartnerName(undefined);
          }
        } else {
          setPartnerPhotos([]);
          setPartnerName(undefined);
        }
      } catch (error: any) {
        console.error('Error setting up photo subscriptions:', error);
        Alert.alert('Error', 'Failed to load photos. Please try again.');
        setLoadingPhotos(false);
        setRefreshing(false);
      }
    };

    setupPhotoSubscriptions();

    // Cleanup subscriptions on unmount or when user changes
    return () => {
      if (unsubscribeUserPhotos) unsubscribeUserPhotos();
      if (unsubscribePartnerPhotos) unsubscribePartnerPhotos();
    };
  }, [user]);

  // Refresh photos manually (real-time listeners will automatically update)
  const handleRefresh = async () => {
    setRefreshing(true);
    // The real-time listeners will automatically update, so we just need to wait a moment
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Handle image load errors - filter out broken images
  const handleImageError = useCallback((photo: Photo) => {
    if (photo.id && !brokenImageIds.has(photo.id)) {
      setBrokenImageIds(prev => {
        const newSet = new Set(prev);
        newSet.add(photo.id!);
        return newSet;
      });
    }
  }, [brokenImageIds]);

  // Check upload status and update state
  const checkUploadStatus = useCallback(async () => {
    if (!user) return;

    try {
      const status = await canUploadInCurrentHour(user.uid);
      setCanUpload(status.canUpload);
      setUploadRestrictionReason(status.reason || null);
    } catch (error: any) {
      console.error('Error checking upload status:', error);
    }
  }, [user]);

  // Subscribe to user data changes for awake status
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserData(user.uid, (userData) => {
      if (userData) {
        // Update awake status (default to true if not set)
        const newIsAwake = userData.isAwake !== false;
        setIsAwake(newIsAwake);
        // Update notification schedule when awake status changes
        updateNotificationSchedule(newIsAwake);
        // Check upload status when user data changes
        checkUploadStatus();
      } else {
        setIsAwake(null);
      }
    });

    return () => unsubscribe();
  }, [user, checkUploadStatus]);
  
  // Initialize notifications when component mounts
  useEffect(() => {
    if (!user) return;

    const initNotifications = async () => {
      try {
        const userData = await getUserData(user.uid);
        const initialIsAwake = userData?.isAwake !== false;
        await initializeNotifications(initialIsAwake);
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initNotifications();

    // Cleanup on unmount
    return () => {
      resetNotifications();
    };
  }, [user]);

  // Check upload status on mount and when user changes
  useEffect(() => {
    checkUploadStatus();
  }, [checkUploadStatus]);

  // Countdown timer that updates every second
  useEffect(() => {
    const updateTimer = () => {
      const timeMs = getTimeUntilNextHour();
      setTimeUntilNextHour(Math.floor(timeMs / 1000)); // Convert to seconds
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);


  const pickImage = async (type: 'regular' | 'goodnight' | 'goodmorning' = 'regular') => {
    // Request permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Sorry, we need camera permissions to take photos!'
      );
      return;
    }

    try {
      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setUploadStatus('');
        setCaption('');
        setUploadType(type);
        setUploadModalVisible(true);
      }
    } catch (error: any) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleGoodnight = () => {
    pickImage('goodnight');
  };

  const handleGoodmorning = () => {
    pickImage('goodmorning');
  };

  const uploadImage = async () => {
    if (!selectedImage || !user) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    // Validate caption
    if (!caption || caption.trim().length === 0) {
      Alert.alert('Caption Required', 'Please enter a caption for your image');
      return;
    }

    // Validate hourly restrictions for regular uploads
    if (uploadType === 'regular') {
      const status = await canUploadInCurrentHour(user.uid);
      if (!status.canUpload) {
        Alert.alert(
          'Upload Restricted',
          status.reason || 'You cannot upload at this time.'
        );
        return;
      }
    }

    setUploading(true);
    setUploadStatus('Uploading...');

    try {
      let result;
      
      // Handle different upload types
      if (uploadType === 'goodnight') {
        result = await sendGoodnightUpdate(user.uid, selectedImage, caption);
      } else if (uploadType === 'goodmorning') {
        result = await sendGoodmorningUpdate(user.uid, selectedImage, caption);
      } else {
        // Regular upload
        result = await uploadUserImage(user.uid, selectedImage, caption);
        
        // Update last upload hour after successful regular upload
        if (result.success) {
          const currentHour = getCurrentHourWindow();
          await updateLastUploadHour(user.uid, currentHour);
        }
      }

      if (result.success) {
        setUploadStatus('Upload successful!');
        
        // Refresh upload status
        await checkUploadStatus();
        
        const successMessage = uploadType === 'goodnight' 
          ? 'Goodnight update sent! Sleep well!'
          : uploadType === 'goodmorning'
          ? 'Good morning update sent! Have a great day!'
          : 'Image uploaded successfully!';
        
        Alert.alert(
          'Success',
          successMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                setSelectedImage(null);
                setCaption('');
                setUploadStatus('');
                setUploadModalVisible(false);
                setUploadType('regular');
              },
            },
          ]
        );
      } else {
        setUploadStatus('Upload failed');
        Alert.alert(
          'Upload Error',
          result.error || 'Failed to upload image. Please try again.'
        );
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setUploadStatus('Upload failed');
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  // Check if viewing image belongs to current user
  const isViewingOwnPhoto = useMemo(() => {
    if (!viewingImage || !viewingImage.id) return false;
    return userPhotos.some(photo => photo.id === viewingImage.id);
  }, [viewingImage, userPhotos]);

  // Handle image click to open modal
  const handleImagePress = useCallback((photo: Photo) => {
    setViewingImage(photo);
    setModalVisible(true);
  }, []);

  // Handle photo deletion
  const handleDeletePhoto = useCallback(async () => {
    if (!viewingImage || !viewingImage.id || !user) {
      return;
    }

    Alert.alert(
      'Delete Update',
      'Are you sure you want to delete this update? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingPhoto(true);
            try {
              const result = await deleteUserPhoto(user.uid, viewingImage.id!);
              
              if (result.success) {
                // Close modal - the real-time subscription will automatically update the UI
                setModalVisible(false);
                setViewingImage(null);
                Alert.alert('Success', 'Update deleted successfully');
              } else {
                Alert.alert('Error', result.error || 'Failed to delete update');
              }
            } catch (error: any) {
              console.error('Error deleting photo:', error);
              Alert.alert('Error', error.message || 'Failed to delete update');
            } finally {
              setDeletingPhoto(false);
            }
          }
        }
      ]
    );
  }, [viewingImage, user]);

  // Close modal
  const closeModal = () => {
    setModalVisible(false);
    setViewingImage(null);
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#D4A574"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>LoveHour</Text>
          
          {/* Status Indicator and Countdown Timer */}
          <View style={styles.statusContainer}>
            {isAwake !== null && (
              <View style={[styles.statusBadge, isAwake ? styles.awakeBadge : styles.asleepBadge]}>
                <Text style={styles.statusText}>
                  {isAwake ? '🌅 Awake' : '🌙 Asleep'}
                </Text>
              </View>
            )}
            {isAwake && (
              <View style={styles.timerContainer}>
                <Text style={styles.timerText}>
                  Next upload in: {Math.floor(timeUntilNextHour / 60)}:{(timeUntilNextHour % 60).toString().padStart(2, '0')}
                </Text>
              </View>
            )}
          </View>

          {/* Upload Restriction Message */}
          {!canUpload && uploadRestrictionReason && (
            <View style={styles.restrictionContainer}>
              <Text style={styles.restrictionText}>{uploadRestrictionReason}</Text>
            </View>
          )}

          {/* Send Update Button - Only show when awake */}
          {isAwake === true && (
            <TouchableOpacity
              style={[styles.sendUpdateButtonLarge, !canUpload && styles.sendUpdateButtonDisabled]}
              onPress={() => pickImage('regular')}
              activeOpacity={0.8}
              disabled={!canUpload}
            >
              <View style={styles.sendUpdateButtonContent}>
                <Text style={styles.sendUpdateButtonIcon}>+</Text>
                <Text style={styles.sendUpdateButtonText}>Send Update</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Goodnight/Goodmorning Buttons */}
          {isAwake === true && (
            <TouchableOpacity
              style={styles.goodnightButton}
              onPress={handleGoodnight}
            >
              <Text style={styles.goodnightButtonText}>🌙 Send Goodnight</Text>
            </TouchableOpacity>
          )}
          {isAwake === false && (
            <TouchableOpacity
              style={styles.goodmorningButton}
              onPress={handleGoodmorning}
            >
              <Text style={styles.goodmorningButtonText}>🌅 Send Good Morning</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Featured Partner Update Section */}
        <View style={styles.featuredUpdateSection}>
          <Text style={styles.featuredUpdateTitle}>
            Latest Update from {partnerName || 'Partner'}
          </Text>
          {loadingPhotos ? (
            <View style={styles.featuredUpdateCard}>
              <View style={styles.featuredUpdateImageFrame}>
                <ActivityIndicator size="large" color="#D4A574" />
              </View>
            </View>
          ) : partnerPhotos.length > 0 ? (
            <TouchableOpacity
              style={styles.featuredUpdateCard}
              onPress={() => {
                if (partnerPhotos[0]) {
                  setViewingImage(partnerPhotos[0]);
                  setModalVisible(true);
                }
              }}
              activeOpacity={0.9}
            >
              <View style={styles.featuredUpdateImageFrame}>
                <Image 
                  source={{ uri: partnerPhotos[0].url }} 
                  style={styles.featuredUpdateImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.featuredUpdateCaptionFrame}>
                <Text style={styles.featuredUpdateCaption}>{partnerPhotos[0].caption}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.featuredUpdateCard}>
              <View style={styles.featuredUpdateImageFrame}>
                <View style={styles.emptyFeaturedContainer}>
                  <Text style={styles.emptyFeaturedText}>No updates from partner yet</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* View All Buttons */}
        <View style={styles.viewAllButtonsContainer}>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => {
              setGalleryActiveTab('partner');
              setGalleryModalVisible(true);
            }}
          >
            <Text style={styles.viewAllButtonText}>View All Partner's Updates</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => {
              setGalleryActiveTab('your');
              setGalleryModalVisible(true);
            }}
          >
            <Text style={styles.viewAllButtonText}>View All My Updates</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Upload Modal */}
      <Modal
        visible={uploadModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setUploadModalVisible(false);
          setSelectedImage(null);
          setCaption('');
          setUploadType('regular');
        }}
      >
        <KeyboardAvoidingView
          style={styles.uploadModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.uploadModalOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <ScrollView
                  style={styles.uploadModalScrollView}
                  contentContainerStyle={styles.uploadModalContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                >
                  <View style={styles.uploadModalHeader}>
                    <Text style={styles.uploadModalTitle}>
                      {uploadType === 'goodnight' 
                        ? 'Send Goodnight' 
                        : uploadType === 'goodmorning'
                        ? 'Send Good Morning'
                        : 'Send Update'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setUploadModalVisible(false);
                        setSelectedImage(null);
                        setCaption('');
                        setUploadType('regular');
                      }}
                    >
                      <Text style={styles.uploadModalClose}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {selectedImage && (
                    <>
                      <View style={styles.uploadImagePreviewContainer}>
                        <Image source={{ uri: selectedImage }} style={styles.uploadImagePreview} />
                        <TouchableOpacity
                          style={styles.changeImageButton}
                          onPress={() => pickImage(uploadType)}
                          disabled={uploading}
                        >
                          <Text style={styles.changeImageText}>Change Image</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.captionContainer}>
                        <Text style={styles.captionLabel}>Caption *</Text>
                        <TextInput
                          style={styles.captionInput}
                          value={caption}
                          onChangeText={setCaption}
                          placeholder="Enter a caption for your image"
                          placeholderTextColor="#999"
                          multiline
                          numberOfLines={3}
                          maxLength={200}
                          editable={!uploading}
                          blurOnSubmit={true}
                        />
                        <Text style={styles.captionHint}>{caption.length}/200</Text>
                      </View>

                      {uploadStatus && (
                        <Text style={styles.uploadStatusText}>{uploadStatus}</Text>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.button,
                          styles.uploadButton,
                          (uploading || !caption.trim()) && styles.buttonDisabled,
                        ]}
                        onPress={uploadImage}
                        disabled={uploading || !caption.trim()}
                      >
                        {uploading ? (
                          <View style={styles.uploadingContainer}>
                            <ActivityIndicator color="#fff" style={styles.spinner} />
                            <Text style={styles.buttonText}>Uploading...</Text>
                          </View>
                        ) : (
                          <Text style={styles.buttonText}>Send Update</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </ScrollView>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-Screen Image Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalContainer} onPress={closeModal}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderButtons}>
              {isViewingOwnPhoto && (
                <TouchableOpacity 
                  style={styles.modalDeleteButton} 
                  onPress={handleDeletePhoto}
                  disabled={deletingPhoto}
                >
                  {deletingPhoto ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalDeleteText}>🗑️</Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            {viewingImage && (
              <>
                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                  minimumZoomScale={1}
                  maximumZoomScale={5}
                  showsVerticalScrollIndicator={true}
                  showsHorizontalScrollIndicator={true}
                  bouncesZoom={true}
                  scrollEventThrottle={16}
                >
                  <Image
                    source={{ uri: viewingImage.url }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                </ScrollView>
                <View style={styles.modalCaptionContainer}>
                  <Text style={styles.modalCaptionText}>{viewingImage.caption}</Text>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Gallery Modal */}
      <Modal
        visible={galleryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setGalleryModalVisible(false)}
      >
        <View style={styles.galleryModalContainer}>
          <View style={styles.galleryModalContent}>
            <View style={styles.galleryModalHeader}>
              <Text style={styles.galleryModalTitle}>Photo Gallery</Text>
              <TouchableOpacity
                onPress={() => setGalleryModalVisible(false)}
              >
                <Text style={styles.galleryModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.galleryModalScrollView}
              contentContainerStyle={styles.galleryModalScrollContent}
            >
              {/* Tabs */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, galleryActiveTab === 'your' && styles.activeTab]}
                  onPress={() => setGalleryActiveTab('your')}
                >
                  <Text style={[styles.tabText, galleryActiveTab === 'your' && styles.activeTabText]}>
                    Your Photos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, galleryActiveTab === 'partner' && styles.activeTab]}
                  onPress={() => setGalleryActiveTab('partner')}
                >
                  <Text style={[styles.tabText, galleryActiveTab === 'partner' && styles.activeTabText]}>
                    Partner Photos
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Photo Gallery */}
              <View style={styles.gallerySection}>
                <PhotoGallery 
                  photos={galleryActiveTab === 'your' ? userPhotos : partnerPhotos} 
                  showUploadButton={false}
                  brokenImageIdsArray={brokenImageIdsArray}
                  activeTab={galleryActiveTab}
                  canUpload={canUpload}
                  onPickImage={pickImage}
                  onImagePress={handleImagePress}
                  onImageError={handleImageError}
                  loadingPhotos={loadingPhotos}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffe6d5',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#8B6F47',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 20,
    color: '#6B5B4A',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: '#D4A574',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#D4A574',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B5B4A',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700',
  },
  gallerySection: {
    minHeight: 200,
    marginBottom: 30,
  },
  galleryContainer: {
    padding: 0,
  },
  dateSection: {
    marginBottom: 30,
  },
  dateSectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#8B6F47',
    marginBottom: 12,
    paddingLeft: 5,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: '100%',
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    marginRight: 5,
    marginBottom: 5,
    marginTop: 0,
    marginLeft: 0,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadButtonItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    marginRight: 5,
    marginBottom: 5,
    marginTop: 0,
    marginLeft: 0,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#D4A574',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonIcon: {
    fontSize: 32,
    color: '#D4A574',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  uploadButtonText: {
    fontSize: 12,
    color: '#8B6F47',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8B6F47',
    textAlign: 'center',
    marginTop: 10,
  },
  button: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  pickButton: {
    backgroundColor: '#D4A574',
    borderWidth: 2,
    borderColor: '#8B6F47',
  },
  uploadButton: {
    backgroundColor: '#D4A574',
    borderWidth: 2,
    borderColor: '#8B6F47',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  spinner: {
    marginRight: 0,
  },
  uploadStatusText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B5B4A',
    textAlign: 'center',
  },
  captionContainer: {
    marginBottom: 15,
  },
  captionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B5B4A',
    marginBottom: 8,
    marginLeft: 4,
  },
  captionInput: {
    borderWidth: 2,
    borderColor: '#D4A574',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    minHeight: 80,
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  captionHint: {
    fontSize: 12,
    color: '#8B6F47',
    textAlign: 'right',
    marginTop: 4,
  },
  signOutButton: {
    alignSelf: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#D4A574',
    marginTop: 20,
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutText: {
    color: '#8B6F47',
    fontSize: 16,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderButtons: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    flexDirection: 'row',
    gap: 10,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalDeleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(220, 53, 69, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDeleteText: {
    fontSize: 20,
  },
  modalScrollView: {
    flex: 1,
    width: '100%',
  },
  modalScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  modalImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  modalCaptionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    paddingBottom: 40,
  },
  modalCaptionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  uploadModalContainer: {
    flex: 1,
  },
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  uploadModalScrollView: {
    maxHeight: '90%',
  },
  uploadModalContent: {
    backgroundColor: '#ffe6d5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  uploadModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B6F47',
    letterSpacing: 0.5,
  },
  uploadModalClose: {
    fontSize: 28,
    color: '#8B6F47',
    fontWeight: 'bold',
  },
  uploadImagePreviewContainer: {
    marginBottom: 20,
  },
  uploadImagePreview: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    resizeMode: 'cover',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#D4A574',
  },
  changeImageButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#D4A574',
    alignItems: 'center',
  },
  changeImageText: {
    color: '#8B6F47',
    fontSize: 14,
    fontWeight: '600',
  },
  statusContainer: {
    marginTop: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  awakeBadge: {
    backgroundColor: '#D4A574',
  },
  asleepBadge: {
    backgroundColor: '#6B5B4A',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  timerContainer: {
    marginTop: 5,
  },
  timerText: {
    fontSize: 14,
    color: '#8B6F47',
    fontWeight: '600',
  },
  goodnightButton: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#6B5B4A',
    borderWidth: 2,
    borderColor: '#8B6F47',
    alignItems: 'center',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  goodnightButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  goodmorningButton: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#D4A574',
    borderWidth: 2,
    borderColor: '#8B6F47',
    alignItems: 'center',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  goodmorningButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  restrictionContainer: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  restrictionText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '600',
  },
  uploadButtonItemDisabled: {
    opacity: 0.5,
  },
  sendUpdateButtonLarge: {
    width: '100%',
    minHeight: 120,
    marginTop: 15,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#D4A574',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sendUpdateButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendUpdateButtonIcon: {
    fontSize: 48,
    color: '#D4A574',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sendUpdateButtonText: {
    fontSize: 18,
    color: '#8B6F47',
    fontWeight: '700',
    textAlign: 'center',
  },
  sendUpdateButtonDisabled: {
    opacity: 0.5,
  },
  featuredUpdateSection: {
    marginTop: 30,
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  featuredUpdateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#8B6F47',
    marginBottom: 16,
    textAlign: 'center',
  },
  featuredUpdateCard: {
    width: '100%',
    marginBottom: 20,
  },
  featuredUpdateImageFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#D4A574',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 12,
  },
  featuredUpdateImage: {
    width: '100%',
    height: '100%',
  },
  featuredUpdateCaptionFrame: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4A574',
    padding: 16,
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  featuredUpdateCaption: {
    fontSize: 16,
    color: '#6B5B4A',
    lineHeight: 22,
    textAlign: 'center',
  },
  viewAllButtonsContainer: {
    paddingHorizontal: 24,
    marginBottom: 30,
    gap: 12,
  },
  viewAllButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#D4A574',
    borderWidth: 2,
    borderColor: '#8B6F47',
    alignItems: 'center',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  viewAllButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  galleryModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  galleryModalContent: {
    backgroundColor: '#ffe6d5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    flex: 1,
  },
  galleryModalScrollView: {
    flex: 1,
  },
  galleryModalScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  galleryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#D4A574',
  },
  galleryModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B6F47',
    letterSpacing: 0.5,
  },
  galleryModalClose: {
    fontSize: 28,
    color: '#8B6F47',
    fontWeight: 'bold',
  },
  emptyFeaturedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyFeaturedText: {
    fontSize: 16,
    color: '#8B6F47',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default LoveHourScreen;
