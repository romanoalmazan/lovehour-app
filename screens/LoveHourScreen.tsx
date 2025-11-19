import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const LoveHourScreen: React.FC = () => {
  const { user } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LoveHour</Text>
      <Text style={styles.subtitle}>Welcome, {displayName}</Text>
      <Text style={styles.placeholder}>This screen is under construction</Text>
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
});

export default LoveHourScreen;

