import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageType } from '../utils/imageConfig';

interface WatchlistItem {
	id: number;
	name: string;
	currentPrice: number;
	groupName: string; // Add group property to items
}

interface WatchlistGroup {
	name: string;
	createdAt: number;
}

interface UserProfile {
	username: string;
	joinDate: number;
	preferences: {
		imageType: ImageType;
		darkMode: boolean;
		currency: string;
	};
}

interface Store {
	watchlist: WatchlistItem[];
	watchlistGroups: WatchlistGroup[];
	userProfile: UserProfile;
	addToWatchlist: (
		item: Omit<WatchlistItem, 'groupName'>,
		groupName?: string
	) => void;
	removeFromWatchlist: (id: number) => void;
	isInWatchlist: (id: number) => boolean;
	// Group management
	createWatchlistGroup: (name: string) => void;
	deleteWatchlistGroup: (name: string) => void;
	renameWatchlistGroup: (oldName: string, newName: string) => void;
	moveItemToGroup: (itemId: number, groupName: string) => void;
	getCurrentGroupItems: (groupName: string) => WatchlistItem[];
	// User profile
	updateUsername: (username: string) => void;
	updateImagePreference: (imageType: ImageType) => void;
	toggleDarkMode: () => void;
	updateCurrency: (currency: string) => void;
}

// Default profile
const DEFAULT_PROFILE: UserProfile = {
	username: 'OSRS Trader',
	joinDate: Date.now(),
	preferences: {
		imageType: ImageType.NORMAL,
		darkMode: true,
		currency: 'gp',
	},
};

export const useStore = create<Store>()(
	persist(
		(set, get) => ({
			watchlist: [],
			watchlistGroups: [{ name: 'default', createdAt: Date.now() }], // Initialize with default group
			userProfile: DEFAULT_PROFILE,
			addToWatchlist: (item, groupName = 'default') =>
				set((state) => {
					// Check if item already exists in watchlist
					if (state.watchlist.some((wItem) => wItem.id === item.id)) {
						return state; // Don't add duplicates
					}

					// Ensure the group exists
					if (
						!state.watchlistGroups.some((group) => group.name === groupName)
					) {
						groupName = 'default'; // Fallback to default if group doesn't exist
					}

					return {
						watchlist: [...state.watchlist, { ...item, groupName }],
					};
				}),
			removeFromWatchlist: (id) =>
				set((state) => ({
					watchlist: state.watchlist.filter((item) => item.id !== id),
				})),
			isInWatchlist: (id) => get().watchlist.some((item) => item.id === id),

			// Group management functions
			createWatchlistGroup: (name) =>
				set((state) => {
					// Check if group already exists
					if (state.watchlistGroups.some((group) => group.name === name)) {
						return state; // Don't add duplicate groups
					}

					return {
						watchlistGroups: [
							...state.watchlistGroups,
							{ name, createdAt: Date.now() },
						],
					};
				}),
			deleteWatchlistGroup: (name) =>
				set((state) => {
					// Don't allow deleting the default group
					if (name === 'default') {
						return state;
					}

					// Move all items from this group to default
					const updatedWatchlist = state.watchlist.map((item) =>
						item.groupName === name ? { ...item, groupName: 'default' } : item
					);

					return {
						watchlistGroups: state.watchlistGroups.filter(
							(group) => group.name !== name
						),
						watchlist: updatedWatchlist,
					};
				}),
			renameWatchlistGroup: (oldName, newName) =>
				set((state) => {
					// Don't allow renaming the default group
					if (oldName === 'default') {
						return state;
					}

					// Check if new name already exists
					if (state.watchlistGroups.some((group) => group.name === newName)) {
						return state;
					}

					// Update the group name
					const updatedGroups = state.watchlistGroups.map((group) =>
						group.name === oldName ? { ...group, name: newName } : group
					);

					// Update all items in the group
					const updatedWatchlist = state.watchlist.map((item) =>
						item.groupName === oldName ? { ...item, groupName: newName } : item
					);

					return {
						watchlistGroups: updatedGroups,
						watchlist: updatedWatchlist,
					};
				}),
			moveItemToGroup: (itemId, groupName) =>
				set((state) => {
					// Ensure group exists
					if (
						!state.watchlistGroups.some((group) => group.name === groupName)
					) {
						return state;
					}

					// Update the item's group
					const updatedWatchlist = state.watchlist.map((item) =>
						item.id === itemId ? { ...item, groupName } : item
					);

					return {
						watchlist: updatedWatchlist,
					};
				}),
			getCurrentGroupItems: (groupName) => {
				return get().watchlist.filter((item) => item.groupName === groupName);
			},

			// User profile functions
			updateUsername: (username) =>
				set((state) => ({
					userProfile: {
						...state.userProfile,
						username,
					},
				})),
			updateImagePreference: (imageType) =>
				set((state) => ({
					userProfile: {
						...state.userProfile,
						preferences: {
							...state.userProfile.preferences,
							imageType,
						},
					},
				})),
			toggleDarkMode: () =>
				set((state) => ({
					userProfile: {
						...state.userProfile,
						preferences: {
							...state.userProfile.preferences,
							darkMode: !state.userProfile.preferences.darkMode,
						},
					},
				})),
			updateCurrency: (currency) =>
				set((state) => ({
					userProfile: {
						...state.userProfile,
						preferences: {
							...state.userProfile.preferences,
							currency,
						},
					},
				})),
		}),
		{
			name: 'osrs-app-storage',
			storage: createJSONStorage(() => AsyncStorage),
		}
	)
);
