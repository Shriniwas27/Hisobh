import React from 'react';
import { useRouter } from 'expo-router';
import { WelcomeScreen } from '../components/auth/WelcomeScreen';

export default function WelcomeRoute() {
  const router = useRouter();

  return (
    <WelcomeScreen
      onComplete={() => {
        router.replace('/(tabs)');
      }}
    />
  );
}

