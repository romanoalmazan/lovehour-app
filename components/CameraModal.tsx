import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';

const { width, height } = Dimensions.get('window');

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ visible, onClose, onCapture }) => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleFlipCamera = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;

    if (!permission?.granted) {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to take photos.'
      );
      return;
    }

    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        base64: false,
      });

      if (photo?.uri) {
        let imageUri = photo.uri;

        // On iOS, flip the image horizontally to preserve mirrored selfie appearance
        if (Platform.OS === 'ios' && facing === 'front') {
          try {
            const manipulatedImage = await ImageManipulator.manipulateAsync(
              imageUri,
              [{ flip: ImageManipulator.FlipType.Horizontal }],
              { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
            );
            imageUri = manipulatedImage.uri;
          } catch (manipulateError) {
            console.error('Error manipulating image:', manipulateError);
            // Continue with original image if manipulation fails
          }
        }

        onCapture(imageUri);
        onClose();
      }
    } catch (error: any) {
      console.error('Error capturing photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Camera permission is required to take photos.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.permissionButton, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.container}>
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
          >
            <View style={styles.overlay}>
            {/* Top bar with close button */}
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                disabled={capturing}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
              <TouchableOpacity
                style={styles.flipButton}
                onPress={handleFlipCamera}
                disabled={capturing}
              >
                <Image
                  source={require('./images/rotationicon.png')}
                  style={styles.flipButtonIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.captureButton, capturing && styles.captureButtonDisabled]}
                onPress={handleCapture}
                disabled={capturing}
              >
                {capturing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={styles.captureButtonInner} />
                )}
              </TouchableOpacity>

              <View style={styles.placeholder} />
            </View>
          </View>
        </CameraView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    width: '100%',
    aspectRatio: 9 / 16, // 9:16 ratio (1080x1920)
    maxWidth: width,
    maxHeight: height * 0.9, // Leave some space for controls
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: 50,
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 40,
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipButtonIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#D4A574',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#D4A574',
  },
  placeholder: {
    width: 50,
    height: 50,
  },
  permissionContainer: {
    backgroundColor: '#ffe6d5',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D4A574',
  },
  permissionText: {
    fontSize: 16,
    color: '#8B6F47',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#D4A574',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 10,
    minWidth: 200,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B6F47',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#fff',
  },
  cancelButtonText: {
    color: '#8B6F47',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CameraModal;

