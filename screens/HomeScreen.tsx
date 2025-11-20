import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToUserData, verifyMutualMatch, unmatchUsers, UserData } from '../services/userService';
import { RootStackParamList } from '../types/navigation';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user, signOut } = useAuth();
  const [isMatched, setIsMatched] = useState(false);
  const [partnerData, setPartnerData] = useState<UserData | null>(null);
  const [verifyingMatch, setVerifyingMatch] = useState(false);
  const [unmatching, setUnmatching] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserData(user.uid, async (userData) => {
      if (userData) {
        const matched = userData.matchedWith !== null && userData.matchedWith !== undefined;
        setIsMatched(matched);

        if (matched) {
          // Verify the match is mutual and get partner data
          setVerifyingMatch(true);
          try {
            const verification = await verifyMutualMatch(user.uid);
            if (verification.isValid && verification.partnerData) {
              setPartnerData(verification.partnerData);
              navigation.navigate('LoveHour');
            } else {
              // Match is invalid, show alert and allow user to choose new partner
              Alert.alert(
                'Match Issue',
                'Your match appears to be invalid. This can happen if your partner unmatched or due to a connection issue. Please try matching again.',
                [{ text: 'OK' }]
              );
              setIsMatched(false);
              setPartnerData(null);
            }
          } catch (error) {
            console.error('Error verifying match:', error);
            setIsMatched(false);
            setPartnerData(null);
          } finally {
            setVerifyingMatch(false);
          }
        } else {
          setPartnerData(null);
        }
      } else {
        setIsMatched(false);
        setPartnerData(null);
      }
    });

    return () => unsubscribe();
  }, [user, navigation]);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  const handleUnmatch = async () => {
    if (!user) return;

    Alert.alert(
      'Unmatch',
      'Are you sure you want to unmatch? This will disconnect you from your current partner.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: async () => {
            setUnmatching(true);
            try {
              const result = await unmatchUsers(user.uid);
              if (result.success) {
                Alert.alert('Success', 'You have been unmatched from your partner.');
                setIsMatched(false);
                setPartnerData(null);
              } else {
                Alert.alert('Error', result.message);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to unmatch. Please try again.');
            } finally {
              setUnmatching(false);
            }
          }
        }
      ]
    );
  };

  if (verifyingMatch) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.greeting}>Verifying your match...</Text>
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.greeting}>Welcome, {displayName}</Text>

        {isMatched && partnerData && (
          <View style={styles.matchInfo}>
            <Text style={styles.matchText}>
              Matched with: {partnerData.displayName || partnerData.email?.split('@')[0] || 'Partner'}
            </Text>
            <TouchableOpacity
              style={[styles.unmatchButton, unmatching && styles.unmatchButtonDisabled]}
              onPress={handleUnmatch}
              disabled={unmatching}
            >
              {unmatching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.unmatchButtonText}>Unmatch</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!isMatched && (
          <TouchableOpacity
            style={styles.choosePartnerButton}
            onPress={() => navigation.navigate('ChoosePartner')}
          >
            <Text style={styles.choosePartnerText}>Choose your partner</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 40,
    color: '#333',
  },
  loader: {
    marginTop: 20,
  },
  matchInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  matchText: {
    fontSize: 18,
    color: '#007AFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  unmatchButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unmatchButtonDisabled: {
    opacity: 0.6,
  },
  unmatchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  choosePartnerButton: {
    width: '100%',
    maxWidth: 300,
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  choosePartnerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  signOutButton: {
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  signOutText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;

