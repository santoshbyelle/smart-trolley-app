// ============================================
// MODIFIED: AppNavigator
// - Replaced HOGAuthScreen → FaceAuthScreen
// - Route: 'FaceAuth' (was 'HOGAuth')
// ============================================

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import SplashScreen         from '../screens/SplashScreen';
import ConnectScreen        from '../screens/ConnectScreen';
import DashboardScreen      from '../screens/DashboardScreen';
import TrackingScreen       from '../screens/TrackingScreen';
import MapScreen            from '../screens/MapScreen';
import SettingsScreen       from '../screens/SettingsScreen';
import AccessibilityScreen  from '../screens/AccessibilityScreen';
import AnalyticsScreen      from '../screens/AnalyticsScreen';
import ProfilesScreen       from '../screens/ProfilesScreen';
import AntiTheftScreen      from '../screens/AntiTheftScreen';
import LostTrolleyScreen    from '../screens/LostTrolleyScreen';
import SensorsScreen        from '../screens/SensorsScreen';
import FaceAuthScreen       from '../screens/FaceAuthScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Splash"        component={SplashScreen} />
        <Stack.Screen name="Connect"       component={ConnectScreen} />
        <Stack.Screen name="Main"          component={DashboardScreen} />
        <Stack.Screen name="Tracking"      component={TrackingScreen} />
        <Stack.Screen name="Map"           component={MapScreen} />
        <Stack.Screen name="Settings"      component={SettingsScreen} />
        <Stack.Screen name="Accessibility" component={AccessibilityScreen} />
        <Stack.Screen name="Analytics"     component={AnalyticsScreen} />
        <Stack.Screen name="Profiles"      component={ProfilesScreen} />
        <Stack.Screen name="AntiTheft"     component={AntiTheftScreen} />
        <Stack.Screen name="LostTrolley"   component={LostTrolleyScreen} />
        <Stack.Screen name="Sensors"       component={SensorsScreen} />
        <Stack.Screen name="FaceAuth"      component={FaceAuthScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
