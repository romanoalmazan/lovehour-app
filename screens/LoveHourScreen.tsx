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
const PHOTO_SIZE = (width - 60) / 3; // 3 columns with padding

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
  const PhotoGallery = ({ photos }: { photos: Photo[] }) => {
    if (loadingPhotos) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.emptyText}>Loading photos...</Text>
        </View>
      );
    }

    if (photos.length === 0) {
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
      <FlatList
        data={photos}
        numColumns={3}
        keyExtractor={(item, index) => item.id || `${item.url}-${index}`}
        contentContainerStyle={styles.galleryContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.photoItem}
            onPress={() => handleImagePress(item)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: item.url }} style={styles.photoImage} />
          </TouchableOpacity>
        )}
        scrollEnabled={false}
      />
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
            tintColor="#007AFF"
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
          <PhotoGallery photos={currentPhotos} />
        </View>

        {/* Upload Section */}
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Upload Image</Text>

        {selectedImage && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
          </View>
        )}

        {selectedImage && (
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
        )}

        <TouchableOpacity
          style={[styles.button, styles.pickButton]}
          onPress={pickImage}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>
            {selectedImage ? 'Pick Another Image' : 'Pick Image'}
          </Text>
        </TouchableOpacity>

        {selectedImage && (
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
              <Text style={styles.buttonText}>Upload to Firebase</Text>
            )}
          </TouchableOpacity>
        )}

        {uploadStatus && (
          <Text style={styles.statusText}>{uploadStatus}</Text>
        )}
      </View>

        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

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
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  gallerySection: {
    minHeight: 200,
    marginBottom: 30,
  },
  galleryContainer: {
    padding: 0,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    margin: 5,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
  uploadSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    marginBottom: 20,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  button: {
    width: '100%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  pickButton: {
    backgroundColor: '#007AFF',
  },
  uploadButton: {
    backgroundColor: '#34C759',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    color: '#666',
    textAlign: 'center',
  },
  captionContainer: {
    marginBottom: 15,
  },
  captionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  captionHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  signOutButton: {
    alignSelf: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 20,
  },
  signOutText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
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
});

export default LoveHourScreen;
