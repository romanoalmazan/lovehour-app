import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const LoveHourScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>LoveHour</Text>
        <Text style={styles.subtitle}>Welcome, {displayName}</Text>
        <Text style={styles.placeholder}>This screen is under construction</Text>
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
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 20,
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  signOutButton: {
    alignSelf: 'center',
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

export default LoveHourScreen;

