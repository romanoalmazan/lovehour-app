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
          <ActivityIndicator size="large" color="#D4A574" style={styles.loader} />
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
    backgroundColor: '#ffe6d5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#8B6F47',
    letterSpacing: 1,
  },
  loader: {
    marginTop: 20,
    color: '#D4A574',
  },
  matchInfo: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
    maxWidth: 300,
  },
  matchText: {
    fontSize: 20,
    color: '#6B5B4A',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  unmatchButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d32f2f',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  unmatchButtonDisabled: {
    opacity: 0.6,
  },
  unmatchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  choosePartnerButton: {
    width: '100%',
    maxWidth: 300,
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    backgroundColor: '#D4A574',
    borderWidth: 2,
    borderColor: '#8B6F47',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  choosePartnerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signOutButton: {
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#D4A574',
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

export default HomeScreen;

