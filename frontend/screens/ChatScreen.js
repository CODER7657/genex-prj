/**
 * Chat Screen Component
 * Real-time AI chat interface with crisis detection
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import { GiftedChat, Bubble, InputToolbar, Send } from 'react-native-gifted-chat';
import { Appbar, FAB, Portal, Dialog, Button, Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../hooks/useChat';
import { useCrisisDetection } from '../../hooks/useCrisisDetection';
import CrisisAlert from '../crisis/CrisisAlert';
import MoodQuickCheck from '../mood/MoodQuickCheck';
import LoadingIndicator from '../common/LoadingIndicator';

const ChatScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { 
    messages, 
    sendMessage, 
    isLoading, 
    error,
    clearError,
    connectSocket,
    disconnectSocket 
  } = useChat();
  
  const { 
    crisisDetected, 
    crisisLevel, 
    emergencyResources,
    dismissCrisis 
  } = useCrisisDetection();

  const [showMoodCheck, setShowMoodCheck] = useState(false);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const chatRef = useRef(null);

  // Initialize chat when component mounts
  useEffect(() => {
    connectSocket(user?.id);
    
    // Show mood check-in after 5 minutes of chatting
    const moodCheckTimer = setTimeout(() => {
      setShowMoodCheck(true);
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(moodCheckTimer);
      disconnectSocket();
    };
  }, [user?.id]);

  // Handle crisis alerts
  useEffect(() => {
    if (crisisDetected && crisisLevel === 'high') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowEmergencyDialog(true);
    }
  }, [crisisDetected, crisisLevel]);

  // Handle sending messages
  const onSend = useCallback(async (newMessages = []) => {
    const message = newMessages[0];
    
    try {
      await sendMessage(message.text, route.params?.sessionId);
    } catch (error) {
      Alert.alert(
        'Message Failed',
        'Unable to send your message. Please check your connection and try again.',
        [{ text: 'OK', onPress: clearError }]
      );
    }
  }, [sendMessage, route.params?.sessionId]);

  // Custom bubble styling
  const renderBubble = (props) => (
    <Bubble
      {...props}
      wrapperStyle={{
        right: {
          backgroundColor: '#6B46C1',
          borderRadius: 16,
          marginRight: 8,
          marginVertical: 4,
        },
        left: {
          backgroundColor: '#F3F4F6',
          borderRadius: 16,
          marginLeft: 8,
          marginVertical: 4,
        },
      }}
      textStyle={{
        right: {
          color: '#FFFFFF',
          fontSize: 16,
          lineHeight: 22,
        },
        left: {
          color: '#1F2937',
          fontSize: 16,
          lineHeight: 22,
        },
      }}
    />
  );

  // Custom input toolbar
  const renderInputToolbar = (props) => (
    <InputToolbar
      {...props}
      containerStyle={{
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
      textInputStyle={{
        fontSize: 16,
        lineHeight: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F9FAFB',
        marginRight: 8,
      }}
    />
  );

  // Custom send button
  const renderSend = (props) => (
    <Send {...props}>
      <View style={styles.sendButton}>
        <Ionicons name="send" size={20} color="#FFFFFF" />
      </View>
    </Send>
  );

  const handleEmergencyCall = () => {
    Alert.alert(
      'Emergency Services',
      'This will call emergency services. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call 911', 
          style: 'destructive',
          onPress: () => {
            // In a real app, this would initiate an emergency call
            Linking.openURL('tel:911');
          }
        }
      ]
    );
  };

  const handleCrisisResources = () => {
    setShowEmergencyDialog(false);
    navigation.navigate('CrisisResources', { 
      resources: emergencyResources,
      crisisLevel 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="AI Companion" subtitle="Here to support you" />
        <Appbar.Action 
          icon="emoticon-happy-outline" 
          onPress={() => setShowMoodCheck(true)} 
        />
        <Appbar.Action 
          icon="help-circle-outline" 
          onPress={() => navigation.navigate('Help')} 
        />
      </Appbar.Header>

      {/* Crisis Alert Banner */}
      {crisisDetected && (
        <CrisisAlert
          level={crisisLevel}
          onDismiss={dismissCrisis}
          onGetHelp={() => setShowEmergencyDialog(true)}
        />
      )}

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <GiftedChat
          ref={chatRef}
          messages={messages}
          onSend={onSend}
          user={{
            _id: user?.id || '1',
            name: user?.email ? user.email.split('@')[0] : 'You',
          }}
          renderBubble={renderBubble}
          renderInputToolbar={renderInputToolbar}
          renderSend={renderSend}
          showUserAvatar={false}
          showAvatarForEveryMessage={true}
          placeholder="Share what's on your mind..."
          alwaysShowSend={true}
          scrollToBottom={true}
          loadEarlier={false}
          renderLoading={() => <LoadingIndicator />}
          minInputToolbarHeight={60}
          bottomOffset={Platform.OS === 'ios' ? 34 : 0}
        />
      </KeyboardAvoidingView>

      {/* Emergency FAB */}
      {crisisDetected && crisisLevel === 'high' && (
        <FAB
          style={styles.emergencyFab}
          icon="phone"
          label="Emergency"
          onPress={handleEmergencyCall}
          color="#FFFFFF"
          animated={true}
        />
      )}

      {/* Mood Check-in Modal */}
      <Portal>
        <Dialog 
          visible={showMoodCheck} 
          onDismiss={() => setShowMoodCheck(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Quick Mood Check</Dialog.Title>
          <Dialog.Content>
            <MoodQuickCheck
              onComplete={() => setShowMoodCheck(false)}
              compact={true}
            />
          </Dialog.Content>
        </Dialog>
      </Portal>

      {/* Emergency Resources Dialog */}
      <Portal>
        <Dialog 
          visible={showEmergencyDialog}
          onDismiss={() => setShowEmergencyDialog(false)}
          style={styles.emergencyDialog}
        >
          <Dialog.Title>Need Immediate Help?</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.emergencyText}>
              If you're having thoughts of self-harm or suicide, please reach out for help immediately.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEmergencyDialog(false)}>
              Not Now
            </Button>
            <Button 
              mode="contained" 
              onPress={handleCrisisResources}
              buttonColor="#DC2626"
            >
              Get Resources
            </Button>
            <Button 
              mode="contained" 
              onPress={handleEmergencyCall}
              buttonColor="#EF4444"
            >
              Call 911
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  chatContainer: {
    flex: 1,
  },
  sendButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  emergencyFab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 80,
    backgroundColor: '#DC2626',
  },
  dialog: {
    borderRadius: 16,
  },
  emergencyDialog: {
    borderRadius: 16,
  },
  emergencyText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 16,
  },
});

export default ChatScreen;