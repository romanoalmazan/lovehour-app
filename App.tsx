import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Image } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import ChoosePartnerScreen from './screens/ChoosePartnerScreen';
import LoveHourScreen from './screens/LoveHourScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import UserProfileSetupScreen from './screens/UserProfileSetupScreen';
import ProfileScreen from './screens/ProfileScreen';
import TermsOfServiceScreen from './screens/TermsOfServiceScreen';
import { checkMatchStatus, subscribeToUserData } from './services/userService';
import { BottomTabParamList, RootStackParamList } from './types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#D4A574',
        tabBarInactiveTintColor: '#8B6F47',
        tabBarStyle: {
          backgroundColor: '#ffe6d5',
          borderTopWidth: 2,
          borderTopColor: '#D4A574',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen 
        name="LoveHour" 
        component={LoveHourScreen}
        options={{
          tabBarLabel: 'LoveHour',
          tabBarIcon: ({ focused, color, size }) => (
            <Image
              source={require('./components/images/lovehourtab.png')}
              style={{
                width: size,
                height: size,
                opacity: focused ? 1 : 0.7,
              }}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tab.Screen 
        name="Schedule" 
        component={ScheduleScreen}
        options={{
          tabBarLabel: 'Schedule',
          tabBarIcon: ({ focused, color, size }) => (
            <Image
              source={require('./components/images/calendartab.png')}
              style={{
                width: size * 1.2,
                height: size * 1.2,
                opacity: focused ? 1 : 0.7,
              }}
              resizeMode="contain"
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  const { user, loading, profileComplete } = useAuth();
  const [isMatched, setIsMatched] = useState<boolean | null>(null);
  const [checkingMatch, setCheckingMatch] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsMatched(null);
      setCheckingMatch(false);
      setHasProfile(null);
      setTermsAccepted(null);
      return;
    }

    // Subscribe to user data changes to detect match status, profile completeness, and terms acceptance
    const unsubscribe = subscribeToUserData(user.uid, (userData) => {
      if (userData) {
        setIsMatched(userData.matchedWith !== null && userData.matchedWith !== undefined);
        // Profile is complete if friendCode AND fullName AND gender exist
        setHasProfile(!!(userData.friendCode && userData.fullName && userData.gender));
        // Terms accepted (default to false for backward compatibility)
        setTermsAccepted(userData.termsAccepted === true);
      } else {
        setIsMatched(false);
        setHasProfile(false);
        setTermsAccepted(false);
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
            {termsAccepted === false ? (
              <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            ) : hasProfile === false ? (
              <Stack.Screen name="UserProfileSetup" component={UserProfileSetupScreen} />
            ) : isMatched ? (
              <>
                <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="ChoosePartner" component={ChoosePartnerScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
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
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Set up notification received handler (when app is in foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
      console.log('Notification received:', notification);
      // You can handle foreground notifications here if needed
    });

    // Set up notification response handler (when user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
      console.log('Notification tapped:', response);
      const data = response.notification.request.content.data;
      
      // Handle different notification types
      if (data?.type === 'hourly') {
        // User tapped hourly notification - app will navigate to LoveHour screen automatically
        // since they're already matched
      } else if (data?.type === 'partner_update') {
        // User tapped partner update notification - app will navigate to LoveHour screen
        // and they can view partner photos
      }
    });

    return () => {
      // Clean up listeners
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

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

