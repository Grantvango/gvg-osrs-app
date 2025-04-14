import { Tabs } from 'expo-router';
import { Search, LineChart, BookMarked, User } from 'lucide-react-native';

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				headerShown: true,
				tabBarStyle: {
					backgroundColor: '#2D2D2D',
				},
				tabBarActiveTintColor: '#E6B800',
				tabBarInactiveTintColor: '#8F8F8F',
				headerStyle: {
					backgroundColor: '#2D2D2D',
				},
				headerTintColor: '#E6B800',
			}}
		>
			<Tabs.Screen
				name='watchlist'
				options={{
					title: 'My Lists',
					tabBarIcon: ({ color, size }) => (
						<BookMarked size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='index'
				options={{
					title: 'All Items',
					tabBarIcon: ({ color, size }) => (
						<LineChart size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='search'
				options={{
					title: 'Search',
					tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name='profile'
				options={{
					title: 'Profile',
					tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
				}}
			/>
		</Tabs>
	);
}
