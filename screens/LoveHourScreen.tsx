import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { uploadUserImage, getUserData, verifyMutualMatch, getUserPhotos, Photo } from '../services/userService';

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

const LoveHourScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

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
  
  // Image viewer modal state
  const [viewingImage, setViewingImage] = useState<Photo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Upload modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  // Fetch user and partner photos
  const fetchPhotos = async () => {
    if (!user) return;

    try {
      setLoadingPhotos(true);
      
      // Fetch current user's photos from subcollection
      const photos = await getUserPhotos(user.uid);
      setUserPhotos(photos);

      // Fetch partner's photos if matched
      const verification = await verifyMutualMatch(user.uid);
      if (verification.isValid && verification.partnerData) {
        // Get partner's user ID from current user's matchedWith field
        const userData = await getUserData(user.uid);
        if (userData?.matchedWith) {
          const partnerPhotosData = await getUserPhotos(userData.matchedWith);
          setPartnerPhotos(partnerPhotosData);
        } else {
          setPartnerPhotos([]);
        }
      } else {
        setPartnerPhotos([]);
      }
    } catch (error: any) {
      console.error('Error fetching photos:', error);
      Alert.alert('Error', 'Failed to load photos. Please try again.');
    } finally {
      setLoadingPhotos(false);
      setRefreshing(false);
    }
  };

  // Refresh photos manually
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPhotos();
  };

  // Load photos on mount
  useEffect(() => {
    fetchPhotos();
  }, [user]);

  // Format date header (Today, Yesterday, or formatted date)
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

  // Group photos by date
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

  const pickImage = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Sorry, we need camera roll permissions to upload images!'
      );
      return;
    }

    try {
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setUploadStatus('');
        setCaption('');
        setUploadModalVisible(true);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
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

    setUploading(true);
    setUploadStatus('Uploading...');

    try {
      const result = await uploadUserImage(user.uid, selectedImage, caption);

      if (result.success && result.downloadURL) {
        setUploadStatus('Upload successful!');
        // Refresh photos after successful upload
        await fetchPhotos();
        Alert.alert(
          'Success',
          'Image uploaded successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                setSelectedImage(null);
                setCaption('');
                setUploadStatus('');
                setUploadModalVisible(false);
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

  // PhotoGallery component
  const PhotoGallery = ({ photos, showUploadButton }: { photos: Photo[]; showUploadButton?: boolean }) => {
    if (loadingPhotos) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#D4A574" />
          <Text style={styles.emptyText}>Loading photos...</Text>
        </View>
      );
    }

    // Group photos by date
    const dateGroups = groupPhotosByDate(photos);
    
    // Ensure "Today" section exists if upload button should be shown
    const todayLabel = 'Today';
    const todayGroupIndex = dateGroups.findIndex(group => group.label === todayLabel);
    
    if (showUploadButton) {
      if (todayGroupIndex === -1) {
        // Create empty "Today" section if it doesn't exist
        // Use local date (not UTC) for dateKey
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayDateKey = `${year}-${month}-${day}`;
        
        dateGroups.unshift({
          label: todayLabel,
          photos: [],
          dateKey: todayDateKey,
        });
      }
    }

    // Check if we have any photos or sections
    const hasPhotos = photos.length > 0;
    const hasSections = dateGroups.length > 0;

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

    // Render a section with photos in 3-column grid
    const renderPhotoGrid = (sectionPhotos: Photo[]) => {
      return sectionPhotos.map((photo, index) => (
        <TouchableOpacity
          key={photo.id || `${photo.url}-${index}`}
          style={styles.photoItem}
          onPress={() => handleImagePress(photo)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: photo.url }} style={styles.photoImage} />
        </TouchableOpacity>
      ));
    };

    return (
      <View style={styles.galleryContainer}>
        {dateGroups.map((group, groupIndex) => (
          <View key={`date-section-${activeTab}-${groupIndex}-${group.dateKey}`} style={styles.dateSection}>
            <Text style={styles.dateSectionHeader}>{group.label}</Text>
            <View style={styles.photoGrid}>
              {/* Add upload button in "Today" section if needed */}
              {showUploadButton && group.label === todayLabel && (
                <TouchableOpacity
                  style={styles.uploadButtonItem}
                  onPress={pickImage}
                  activeOpacity={0.8}
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
  };

  const currentPhotos = activeTab === 'your' ? userPhotos : partnerPhotos;

  // Handle image click to open modal
  const handleImagePress = (photo: Photo) => {
    setViewingImage(photo);
    setModalVisible(true);
  };

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
          <Text style={styles.subtitle}>Welcome, {displayName}</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'your' && styles.activeTab]}
            onPress={() => setActiveTab('your')}
          >
            <Text style={[styles.tabText, activeTab === 'your' && styles.activeTabText]}>
              Your Photos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'partner' && styles.activeTab]}
            onPress={() => setActiveTab('partner')}
          >
            <Text style={[styles.tabText, activeTab === 'partner' && styles.activeTabText]}>
              Partner Photos
            </Text>
          </TouchableOpacity>
        </View>

        {/* Photo Gallery */}
        <View style={styles.gallerySection}>
          <PhotoGallery photos={currentPhotos} showUploadButton={activeTab === 'your'} />
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
          setUploadModalVisible(false);
          setSelectedImage(null);
          setCaption('');
        }}
      >
        <View style={styles.uploadModalContainer}>
          <View style={styles.uploadModalContent}>
            <View style={styles.uploadModalHeader}>
              <Text style={styles.uploadModalTitle}>Send Update</Text>
              <TouchableOpacity
                onPress={() => {
                  setUploadModalVisible(false);
                  setSelectedImage(null);
                  setCaption('');
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
                    onPress={pickImage}
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
                  />
                  <Text style={styles.captionHint}>{caption.length}/200</Text>
                </View>

                {uploadStatus && (
                  <Text style={styles.statusText}>{uploadStatus}</Text>
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
          </View>
        </View>
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
            <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
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
  statusText: {
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
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  uploadModalContent: {
    backgroundColor: '#ffe6d5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
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
});

export default LoveHourScreen;
