import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToUserData } from '../services/userService';

type RootStackParamList = {
  Home: undefined;
  ChoosePartner: undefined;
  Auth: undefined;
  LoveHour: undefined;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user, signOut } = useAuth();
  const [isMatched, setIsMatched] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserData(user.uid, (userData) => {
      if (userData) {
        const matched = userData.matchedWith !== null && userData.matchedWith !== undefined;
        setIsMatched(matched);
        
        // Redirect to LoveHour if matched
        if (matched) {
          navigation.navigate('LoveHour');
        }
      } else {
        setIsMatched(false);
      }
    });

    return () => unsubscribe();
  }, [user, navigation]);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.greeting}>Welcome, {displayName}</Text>
        
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

