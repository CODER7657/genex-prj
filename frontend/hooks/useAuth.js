/**
 * Authentication Hook
 * Handles Firebase Auth integration and user session management
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  initializeAuth,
  getReactNativePersistence,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';

import { app } from '../api/firebase';
import { apiClient } from '../api/client';

// Initialize Firebase Auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Get Firebase ID token
          const idToken = await firebaseUser.getIdToken();
          
          // Store token securely
          await SecureStore.setItemAsync('firebaseToken', idToken);
          
          // Sync with backend or create user profile
          const userProfile = await syncUserWithBackend(firebaseUser, idToken);
          setUser(userProfile);
        } else {
          // Clear stored token
          await SecureStore.deleteItemAsync('firebaseToken');
          await SecureStore.deleteItemAsync('backendToken');
          setUser(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const syncUserWithBackend = async (firebaseUser, idToken) => {
    try {
      // Check if user exists in backend
      apiClient.setAuthToken(idToken);
      
      const response = await apiClient.get('/auth/me');
      return response.data.user;
    } catch (error) {
      if (error.response?.status === 404) {
        // User doesn't exist in backend, create them
        return await createBackendUser(firebaseUser, idToken);
      }
      throw error;
    }
  };

  const createBackendUser = async (firebaseUser, idToken) => {
    const userData = {
      email: firebaseUser.email,
      age: 18, // Default age, should be collected during onboarding
      anonymous: firebaseUser.isAnonymous,
      termsAccepted: true,
      firebaseUid: firebaseUser.uid
    };

    const response = await apiClient.post('/auth/register', userData);
    
    // Store backend token
    await SecureStore.setItemAsync('backendToken', response.data.token);
    apiClient.setAuthToken(response.data.token);
    
    return response.data.user;
  };

  const signInAnonymouslyHandler = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await signInAnonymously(auth);
      return result.user;
    } catch (error) {
      console.error('Anonymous sign-in error:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (email, password, age, additionalData = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      // Create Firebase user
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create backend user profile
      const userData = {
        email,
        age,
        anonymous: false,
        termsAccepted: true,
        firebaseUid: result.user.uid,
        ...additionalData
      };

      const idToken = await result.user.getIdToken();
      apiClient.setAuthToken(idToken);
      
      const backendResponse = await apiClient.post('/auth/register', userData);
      
      // Store backend token
      await SecureStore.setItemAsync('backendToken', backendResponse.data.token);
      apiClient.setAuthToken(backendResponse.data.token);

      return result.user;
    } catch (error) {
      console.error('Email sign-up error:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      console.error('Email sign-in error:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Configure Google Sign-In
      const request = new AuthSession.AuthRequest({
        clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        redirectUri: AuthSession.makeRedirectUri({
          scheme: 'com.mentalwellnessai.app',
        }),
      });

      const result = await request.promptAsync({
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      });

      if (result.type === 'success') {
        const { id_token } = result.params;
        
        const credential = GoogleAuthProvider.credential(id_token);
        const firebaseResult = await signInWithCredential(auth, credential);
        
        return firebaseResult.user;
      }
      
      throw new Error('Google sign-in was cancelled or failed');
    } catch (error) {
      console.error('Google sign-in error:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOutHandler = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Sign out from Firebase
      await signOut(auth);
      
      // Clear stored tokens
      await SecureStore.deleteItemAsync('firebaseToken');
      await SecureStore.deleteItemAsync('backendToken');
      
      // Clear API client token
      apiClient.setAuthToken(null);
      
      setUser(null);
    } catch (error) {
      console.error('Sign-out error:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (updates) => {
    try {
      setError(null);
      
      const response = await apiClient.patch('/users/profile', updates);
      setUser(response.data.user);
      
      return response.data.user;
    } catch (error) {
      console.error('Profile update error:', error);
      setError(error.message);
      throw error;
    }
  };

  const deleteAccount = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Delete from backend first
      await apiClient.delete('/auth/account');
      
      // Delete Firebase account
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }
      
      // Clear stored data
      await SecureStore.deleteItemAsync('firebaseToken');
      await SecureStore.deleteItemAsync('backendToken');
      
      setUser(null);
    } catch (error) {
      console.error('Account deletion error:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  const value = {
    user,
    isLoading,
    error,
    signInAnonymously: signInAnonymouslyHandler,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut: signOutHandler,
    updateUserProfile,
    deleteAccount,
    clearError,
    isAuthenticated: !!user,
    isAnonymous: user?.anonymous ?? false
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};