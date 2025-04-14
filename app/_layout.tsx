import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { initializeAppData } from '@/utils/dataManager';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function RootLayout() {
	useFrameworkReady();
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Initialize app data when the app starts
	useEffect(() => {
		const loadData = async () => {
			try {
				setIsLoading(true);
				await initializeAppData();
			} catch (error) {
				console.error('Failed to initialize app data:', error);
				setError('Failed to load app data. Please restart the app.');
			} finally {
				setIsLoading(false);
			}
		};

		loadData();
	}, []);

	// Show loading screen while initializing data
	if (isLoading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size='large' color='#E6B800' />
				<Text style={styles.loadingText}>Loading OSRS Price Data...</Text>
				<StatusBar style='auto' />
			</View>
		);
	}

	// Show error screen if initialization failed
	if (error) {
		return (
			<View style={styles.errorContainer}>
				<Text style={styles.errorText}>{error}</Text>
				<StatusBar style='auto' />
			</View>
		);
	}

	return (
		<>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name='(tabs)' options={{ headerShown: false }} />
				<Stack.Screen name='item-details' options={{ headerShown: false }} />
				<Stack.Screen name='+not-found' />
			</Stack>
			<StatusBar style='auto' />
		</>
	);
}

const styles = StyleSheet.create({
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#1A1A1A',
	},
	loadingText: {
		color: '#FFFFFF',
		marginTop: 16,
		fontSize: 16,
	},
	errorContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#1A1A1A',
		padding: 20,
	},
	errorText: {
		color: '#FF4444',
		fontSize: 16,
		textAlign: 'center',
	},
});
