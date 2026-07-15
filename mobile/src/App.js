import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FlashMessage from 'react-native-flash-message';

import useAuthStore from './stores/authStore';
import { AuthStack } from './navigation/AuthStack';
import HomeScreen from './screens/HomeScreen';
import LeadsScreen from './screens/LeadsScreen';
import LeadDetailScreen from './screens/LeadDetailScreen';
import CampaignsScreen from './screens/CampaignsScreen';
import ReportsScreen from './screens/ReportsScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const LeadsStack = createNativeStackNavigator();

function LeadsStackNavigator() {
  return (
    <LeadsStack.Navigator screenOptions={{ headerShown: false }}>
      <LeadsStack.Screen name="LeadsList" component={LeadsScreen} />
      <LeadsStack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ headerShown: true, title: 'Lead Details', headerTintColor: '#0f172a' }} />
    </LeadsStack.Navigator>
  );
}

export default function App() {
  const { isAuthenticated, init } = useAuthStore();

  useEffect(() => { init(); }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {isAuthenticated ? (
          <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#2563eb', tabBarInactiveTintColor: '#94a3b8', headerShown: false }}>
            <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color }) => <Icon name="home" size={24} color={color} /> }} />
            <Tab.Screen name="Leads" component={LeadsStackNavigator} options={{ tabBarIcon: ({ color }) => <Icon name="account-group" size={24} color={color} /> }} />
            <Tab.Screen name="Campaigns" component={CampaignsScreen} options={{ tabBarIcon: ({ color }) => <Icon name="email" size={24} color={color} /> }} />
            <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarIcon: ({ color }) => <Icon name="chart-bar" size={24} color={color} /> }} />
            <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: ({ color }) => <Icon name="cog" size={24} color={color} /> }} />
          </Tab.Navigator>
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>
      <FlashMessage position="top" />
    </SafeAreaProvider>
  );
}
