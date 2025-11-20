import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import ChoosePartnerScreen from './screens/ChoosePartnerScreen';
import LoveHourScreen from './screens/LoveHourScreen';
import UserProfileSetupScreen from './screens/UserProfileSetupScreen';
import { checkMatchStatus, subscribeToUserData } from './services/userService';

const Stack = createNativeStackNavigator();

const AppNavigator: React.FC = () => {
  const { user, loading, profileComplete } = useAuth();
  const [isMatched, setIsMatched] = useState<boolean | null>(null);
  const [checkingMatch, setCheckingMatch] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsMatched(null);
      setCheckingMatch(false);
      setHasProfile(null);
      return;
    }

    // Subscribe to user data changes to detect match status and profile completeness
    const unsubscribe = subscribeToUserData(user.uid, (userData) => {
      if (userData) {
        setIsMatched(userData.matchedWith !== null && userData.matchedWith !== undefined);
        // Profile is complete if friendCode AND fullName AND gender exist
        setHasProfile(!!(userData.friendCode && userData.fullName && userData.gender));
      } else {
        setIsMatched(false);
        setHasProfile(false);
      }
      setCheckingMatch(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading || checkingMatch) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            {hasProfile === false ? (
              <Stack.Screen name="UserProfileSetup" component={UserProfileSetupScreen} />
            ) : isMatched ? (
              <Stack.Screen name="LoveHour" component={LoveHourScreen} />
            ) : (
              <>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="ChoosePartner" component={ChoosePartnerScreen} />
              </>
            )}
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default App;

