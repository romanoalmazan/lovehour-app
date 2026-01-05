import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ScheduleScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Schedule</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffe6d5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    color: '#8B6F47',
    fontWeight: 'bold',
  },
});

export default ScheduleScreen;

