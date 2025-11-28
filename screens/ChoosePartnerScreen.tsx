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
import { sanitizeFriendCode } from '../utils/friendCodeGenerator';

const ChoosePartnerScreen: React.FC = () => {
  const { user } = useAuth();
  const [friendCode, setFriendCode] = useState<string>('');
  const [partnerCode, setPartnerCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [inputError, setInputError] = useState<string>('');

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
    const sanitized = sanitizeFriendCode(partnerCode);

    if (!sanitized.isValid) {
      setInputError(sanitized.error || 'Invalid friend code');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setMatching(true);
    setInputError(''); // Clear any previous errors

    try {
      const result = await matchUsers(user.uid, sanitized.code);

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
        <ActivityIndicator size="large" color="#D4A574" />
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
              style={[styles.input, inputError ? styles.inputError : null]}
              value={partnerCode}
              onChangeText={(text) => {
                const sanitized = sanitizeFriendCode(text);
                setPartnerCode(sanitized.code);
                // Clear error when user fixes the input
                if (inputError && sanitized.isValid) setInputError('');
              }}
              placeholder="Enter 6-character friend code"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              maxLength={6}
              autoCorrect={false}
              spellCheck={false}
            />
            {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}
            <TouchableOpacity
              style={[styles.matchButton, (matching || !!inputError) && styles.matchButtonDisabled]}
              onPress={handleMatch}
              disabled={matching || !!inputError}
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
    backgroundColor: '#ffe6d5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffe6d5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#8B6F47',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B5B4A',
    marginBottom: 8,
    marginLeft: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
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
  codeText: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B6F47',
    letterSpacing: 2,
  },
  copyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#D4A574',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#8B6F47',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    fontSize: 14,
    color: '#8B6F47',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  input: {
    borderWidth: 2,
    borderColor: '#D4A574',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    backgroundColor: '#fff',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '600',
    color: '#333',
    shadowColor: '#8B6F47',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: '#ff3b30',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: -12,
  },
  matchButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: '#D4A574',
    borderWidth: 2,
    borderColor: '#8B6F47',
    borderRadius: 12,
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
  matchButtonDisabled: {
    opacity: 0.6,
  },
  matchButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default ChoosePartnerScreen;

