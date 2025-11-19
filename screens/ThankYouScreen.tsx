import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const ThankYouScreen: React.FC = () => {
  const { user, signOut } = useAuth();

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🙏</Text>
        <Text style={styles.title}>Thank you {displayName}</Text>
        <Text style={styles.subtitle}>for signing up for this app</Text>
        <Text style={styles.message}>
          We're excited to have you on board!
        </Text>
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
    marginBottom: 40,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#999',
    marginTop: 10,
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

export default ThankYouScreen;

