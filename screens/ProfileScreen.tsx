import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { getUserData, verifyMutualMatch, UserData, updateUploadInterval } from '../services/userService';
import { RootStackParamList } from '../types/navigation';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, signOut } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [partnerData, setPartnerData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInterval, setSelectedInterval] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadProfileData = async () => {
      try {
        setLoading(true);
        
        // Get user data
        const currentUserData = await getUserData(user.uid);
        setUserData(currentUserData);
        // Set selected interval (default to 1 hour if not set)
        setSelectedInterval(currentUserData?.uploadIntervalHours || 1);

        // Get partner data if matched
        if (currentUserData?.matchedWith) {
          const verification = await verifyMutualMatch(user.uid);
          if (verification.isValid && verification.partnerData) {
            setPartnerData(verification.partnerData);
          } else {
            setPartnerData(null);
          }
        } else {
          setPartnerData(null);
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [user]);

  const userName = userData?.fullName || userData?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User';
  const partnerName = partnerData?.fullName || partnerData?.displayName || partnerData?.email?.split('@')[0] || null;
  const intervalOptions = [1, 3, 5, 7, 9, 11];

  const handleIntervalChange = async (interval: number) => {
    if (!user || saving || interval === selectedInterval) return;
    
    setSaving(true);
    try {
      await updateUploadInterval(user.uid, interval);
      setSelectedInterval(interval);
      // Reload user data to get updated value
      const updatedUserData = await getUserData(user.uid);
      setUserData(updatedUserData);
    } catch (error) {
      console.error('Error updating upload interval:', error);
      Alert.alert('Error', 'Failed to update upload interval. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D4A574" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.profileSection}>
          <Text style={styles.sectionLabel}>Your Name</Text>
          <View style={styles.nameCard}>
            <Text style={styles.nameText}>{userName}</Text>
          </View>
        </View>

        <View style={styles.profileSection}>
          <Text style={styles.sectionLabel}>Matched With</Text>
          <View style={styles.nameCard}>
            {partnerName ? (
              <Text style={styles.nameText}>{partnerName}</Text>
            ) : (
              <Text style={styles.noMatchText}>Not matched</Text>
            )}
          </View>
        </View>

        <View style={styles.profileSection}>
          <Text style={styles.sectionLabel}>Update Interval</Text>
          <Text style={styles.sectionDescription}>
            How often you can send an update
          </Text>
          <View style={styles.intervalSelector}>
            {intervalOptions.map((interval) => (
              <TouchableOpacity
                key={interval}
                style={[
                  styles.intervalOption,
                  selectedInterval === interval && styles.intervalOptionSelected,
                  saving && styles.intervalOptionDisabled,
                ]}
                onPress={() => handleIntervalChange(interval)}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.intervalOptionText,
                    selectedInterval === interval && styles.intervalOptionTextSelected,
                  ]}
                >
                  {interval}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.intervalSelectorSpacer} />
          {saving && (
            <View style={styles.savingIndicator}>
              <ActivityIndicator size="small" color="#D4A574" />
              <Text style={styles.savingText}>Saving...</Text>
            </View>
          )}
        </View>

        {/* View All Buttons */}
        <View style={styles.viewAllButtonsContainer}>
          <TouchableOpacity
            style={[styles.viewAllButton, styles.viewAllButtonFirst]}
            onPress={() => {
              navigation.navigate('LoveHour', { openGallery: 'partner' });
            }}
          >
            <Text style={styles.viewAllButtonText}>View All Partner's Updates</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => {
              navigation.navigate('LoveHour', { openGallery: 'your' });
            }}
          >
            <Text style={styles.viewAllButtonText}>View All My Updates</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffe6d5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#D4A574',
    backgroundColor: '#ffe6d5',
  },
  backButton: {
    padding: 8,
    minWidth: 40,
  },
  backButtonText: {
    fontSize: 28,
    color: '#8B6F47',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B6F47',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingTop: 30,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    marginBottom: 50,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B5B4A',
    marginBottom: 12,
    marginLeft: 4,
  },
  nameCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
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
  nameText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8B6F47',
  },
  noMatchText: {
    fontSize: 18,
    color: '#999',
    fontStyle: 'italic',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B5B4A',
    marginBottom: 16,
    marginLeft: 4,
  },
  intervalSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 0,
  },
  intervalSelectorSpacer: {
    height: 20,
    width: '100%',
  },
  intervalOption: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#D4A574',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  intervalOptionSelected: {
    backgroundColor: '#D4A574',
    borderColor: '#8B6F47',
    shadowOpacity: 0.2,
    elevation: 3,
  },
  intervalOptionDisabled: {
    opacity: 0.6,
  },
  intervalOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B6F47',
  },
  intervalOptionTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  savingText: {
    fontSize: 14,
    color: '#6B5B4A',
    fontStyle: 'italic',
  },
  viewAllButtonsContainer: {
    marginTop: 40,
    marginBottom: 30,
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
    marginBottom: 12,
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  viewAllButtonFirst: {
    marginTop: 0,
  },
  viewAllButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  signOutButton: {
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#D4A574',
    marginTop: 20,
    marginBottom: 0,
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
  signOutText: {
    color: '#8B6F47',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProfileScreen;

