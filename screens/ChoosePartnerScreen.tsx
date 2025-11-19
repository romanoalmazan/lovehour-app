import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getUserData, matchUsers } from '../services/userService';

const ChoosePartnerScreen: React.FC = () => {
  const { user } = useAuth();
  const [friendCode, setFriendCode] = useState<string>('');
  const [partnerCode, setPartnerCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userData = await getUserData(user.uid);
      if (userData) {
        setFriendCode(userData.friendCode);
      } else {
        Alert.alert(
          'Connection Required',
          'Please check your internet connection and try again. You need to be online to load your friend code.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      // Show the actual error message
      const errorMessage = error.message || 'Failed to load your friend code. Please check your connection.';
      console.error('Error in loadUserData:', error);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async () => {
    if (!partnerCode.trim()) {
      Alert.alert('Error', 'Please enter a friend code');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setMatching(true);
    try {
      const result = await matchUsers(user.uid, partnerCode.trim());
      
      if (result.success) {
        Alert.alert('Success', result.message);
        // Navigation will be handled automatically by App.tsx based on match status change
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to match with partner');
    } finally {
      setMatching(false);
    }
  };

  const copyToClipboard = () => {
    // In a real app, you'd use Clipboard API
    Alert.alert('Friend Code', `Your code: ${friendCode}\n\nShare this code with your partner!`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Choose Your Partner</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Friend Code</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{friendCode}</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={copyToClipboard}
              >
                <Text style={styles.copyButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              Share this code with your partner so they can enter it below
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Enter Partner's Code</Text>
            <TextInput
              style={styles.input}
              value={partnerCode}
              onChangeText={setPartnerCode}
              placeholder="Enter friend code"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              maxLength={10}
            />
            <TouchableOpacity
              style={[styles.matchButton, matching && styles.matchButtonDisabled]}
              onPress={handleMatch}
              disabled={matching}
            >
              {matching ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.matchButtonText}>Match</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  codeText: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 2,
  },
  copyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    backgroundColor: '#fff',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '600',
  },
  matchButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
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
  matchButtonDisabled: {
    opacity: 0.6,
  },
  matchButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ChoosePartnerScreen;

