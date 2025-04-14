import { useState, useEffect } from 'react';
import {
	View,
	Text,
	StyleSheet,
	Switch,
	TouchableOpacity,
	TextInput,
	ScrollView,
	Alert,
	Image,
} from 'react-native';
import { useStore } from '../../store/useStore';
import {
	ImageType,
	setImageType,
	getWikiImageUrl,
} from '../../utils/imageConfig';
import { clearAllImageCache } from '../../utils/images';
import {
	User,
	Save,
	Image as ImageIcon,
	Calendar,
	Moon,
	Trash2,
	Info,
	Coins,
} from 'lucide-react-native';

export default function ProfileScreen() {
	const { userProfile, updateUsername, updateImagePreference, toggleDarkMode } =
		useStore();
	const [editingUsername, setEditingUsername] = useState(false);
	const [newUsername, setNewUsername] = useState(userProfile.username);
	const [showImageExample, setShowImageExample] = useState(false);

	// Example items to show the difference in image styles
	const exampleItems = [
		{ id: 12383, name: '3rd Age Amulet' },
		{ id: 10342, name: 'Dragon Platebody' },
		{ id: 11832, name: 'Bandos Chestplate' },
	];

	useEffect(() => {
		setNewUsername(userProfile.username);
	}, [userProfile.username]);

	const handleUsernameChange = () => {
		updateUsername(newUsername);
		setEditingUsername(false);
	};

	const toggleImageType = async () => {
		// Ask user to confirm since this will clear cache
		Alert.alert(
			'Change Image Type',
			'Changing image type will clear the image cache and download new images. Continue?',
			[
				{
					text: 'Cancel',
					style: 'cancel',
				},
				{
					text: 'Continue',
					onPress: async () => {
						// Toggle the image type
						const newType =
							userProfile.preferences.imageType === ImageType.NORMAL
								? ImageType.DETAILED
								: ImageType.NORMAL;

						// Update store
						updateImagePreference(newType);

						// Update AsyncStorage setting
						await setImageType(newType);

						// Clear all cached images so new ones will be downloaded
						await clearAllImageCache();

						Alert.alert(
							'Image Type Changed',
							`Images will now be displayed in ${newType} style.`
						);
					},
				},
			]
		);
	};

	const renderImageExample = () => {
		return (
			<View style={styles.imageExampleContainer}>
				<Text style={styles.sectionTitle}>Image Style Examples</Text>

				<View style={styles.imageComparisonRow}>
					<View style={styles.imageTypeColumn}>
						<Text style={styles.imageTypeTitle}>Normal</Text>
						{exampleItems.map((item) => (
							<View key={`normal-${item.id}`} style={styles.exampleItem}>
								<Image
									source={{
										uri: `https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${item.id}`,
									}}
									style={styles.exampleImage}
								/>
								<Text style={styles.exampleItemName}>{item.name}</Text>
							</View>
						))}
					</View>

					<View style={styles.imageTypeColumn}>
						<Text style={styles.imageTypeTitle}>Detailed</Text>
						{exampleItems.map((item) => (
							<View key={`detailed-${item.id}`} style={styles.exampleItem}>
								<Image
									source={{ uri: getWikiImageUrl(item.name, true) }}
									style={styles.exampleImage}
								/>
								<Text style={styles.exampleItemName}>{item.name}</Text>
							</View>
						))}
					</View>
				</View>

				<TouchableOpacity
					style={styles.closeButton}
					onPress={() => setShowImageExample(false)}
				>
					<Text style={styles.closeButtonText}>Close Examples</Text>
				</TouchableOpacity>
			</View>
		);
	};

	return (
		<ScrollView style={styles.container}>
			<View style={styles.section}>
				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Profile Information</Text>
				</View>

				<View style={styles.profileInfo}>
					<View style={styles.infoItem}>
						<User size={20} color='#8F8F8F' style={styles.infoIcon} />
						{editingUsername ? (
							<View style={styles.usernameEditContainer}>
								<TextInput
									style={styles.usernameInput}
									value={newUsername}
									onChangeText={setNewUsername}
									autoFocus
								/>
								<TouchableOpacity
									style={styles.saveButton}
									onPress={handleUsernameChange}
								>
									<Save size={20} color='#E6B800' />
								</TouchableOpacity>
							</View>
						) : (
							<View style={styles.usernameContainer}>
								<Text style={styles.infoValue}>{userProfile.username}</Text>
								<TouchableOpacity
									style={styles.editButton}
									onPress={() => setEditingUsername(true)}
								>
									<Text style={styles.editButtonText}>Edit</Text>
								</TouchableOpacity>
							</View>
						)}
					</View>

					<View style={styles.infoItem}>
						<Calendar size={20} color='#8F8F8F' style={styles.infoIcon} />
						<Text style={styles.infoLabel}>Member Since:</Text>
						<Text style={styles.infoValue}>
							{new Date(userProfile.joinDate).toLocaleDateString()}
						</Text>
					</View>
				</View>
			</View>

			<View style={styles.section}>
				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Preferences</Text>
				</View>

				<View style={styles.preferenceItem}>
					<View style={styles.preferenceLabel}>
						<ImageIcon
							size={20}
							color='#8F8F8F'
							style={styles.preferenceIcon}
						/>
						<Text style={styles.preferenceName}>Image Type</Text>
					</View>
					<View style={styles.preferenceControl}>
						<Text style={styles.preferenceValue}>
							{userProfile.preferences.imageType === ImageType.NORMAL
								? 'Normal'
								: 'Detailed'}
						</Text>
						<TouchableOpacity
							style={styles.toggleButton}
							onPress={toggleImageType}
						>
							<Text style={styles.toggleButtonText}>Toggle</Text>
						</TouchableOpacity>
					</View>
				</View>

				{!showImageExample && (
					<TouchableOpacity
						style={styles.viewExampleButton}
						onPress={() => setShowImageExample(true)}
					>
						<Info size={16} color='#E6B800' />
						<Text style={styles.viewExampleText}>View image examples</Text>
					</TouchableOpacity>
				)}

				{showImageExample && renderImageExample()}

				<View style={styles.preferenceItem}>
					<View style={styles.preferenceLabel}>
						<Moon size={20} color='#8F8F8F' style={styles.preferenceIcon} />
						<Text style={styles.preferenceName}>Dark Mode</Text>
					</View>
					<Switch
						value={userProfile.preferences.darkMode}
						onValueChange={toggleDarkMode}
						trackColor={{ false: '#3D3D3D', true: '#E6B800' }}
						thumbColor={
							userProfile.preferences.darkMode ? '#FFFFFF' : '#A0A0A0'
						}
					/>
				</View>

				<View style={styles.preferenceItem}>
					<View style={styles.preferenceLabel}>
						<Coins size={20} color='#8F8F8F' style={styles.preferenceIcon} />
						<Text style={styles.preferenceName}>Currency</Text>
					</View>
					<View style={styles.currencySelector}>
						<Text style={styles.currencyValue}>
							{userProfile.preferences.currency}
						</Text>
						{/* For now, we only support gp so this is just for show */}
						<TouchableOpacity style={styles.currencyButton} disabled>
							<Text style={styles.currencyButtonText}>Change</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>

			<View style={styles.section}>
				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Data Management</Text>
				</View>

				<TouchableOpacity
					style={styles.dangerButton}
					onPress={() => {
						Alert.alert(
							'Clear Image Cache?',
							'This will remove all cached images. They will be re-downloaded when needed.',
							[
								{ text: 'Cancel', style: 'cancel' },
								{
									text: 'Clear Cache',
									onPress: async () => {
										await clearAllImageCache();
										Alert.alert('Success', 'Image cache has been cleared.');
									},
									style: 'destructive',
								},
							]
						);
					}}
				>
					<Trash2 size={20} color='#FF4444' style={styles.dangerButtonIcon} />
					<Text style={styles.dangerButtonText}>Clear Image Cache</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.footer}>
				<Text style={styles.versionText}>OSRS GE Tracker v1.0.0</Text>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#1A1A1A',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#2D2D2D',
	},
	headerTitle: {
		color: '#E6B800',
		fontSize: 24,
		fontWeight: 'bold',
		marginLeft: 12,
	},
	section: {
		marginBottom: 24,
		padding: 16,
		backgroundColor: '#2D2D2D',
		borderRadius: 12,
		marginHorizontal: 16,
		marginTop: 16,
	},
	sectionHeader: {
		borderBottomWidth: 1,
		borderBottomColor: '#3D3D3D',
		paddingBottom: 12,
		marginBottom: 16,
	},
	sectionTitle: {
		color: '#E6B800',
		fontSize: 18,
		fontWeight: 'bold',
	},
	profileInfo: {
		gap: 16,
	},
	infoItem: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	infoIcon: {
		marginRight: 12,
	},
	infoLabel: {
		color: '#8F8F8F',
		fontSize: 16,
		marginRight: 8,
	},
	infoValue: {
		color: '#FFFFFF',
		fontSize: 16,
		flex: 1,
	},
	usernameContainer: {
		flex: 1,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	usernameEditContainer: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	usernameInput: {
		flex: 1,
		color: '#FFFFFF',
		fontSize: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#E6B800',
		paddingVertical: 4,
	},
	saveButton: {
		padding: 8,
		marginLeft: 8,
	},
	editButton: {
		backgroundColor: '#3D3D3D',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 4,
	},
	editButtonText: {
		color: '#E6B800',
		fontSize: 14,
	},
	preferenceItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#3D3D3D',
	},
	preferenceLabel: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	preferenceIcon: {
		marginRight: 12,
	},
	preferenceName: {
		color: '#FFFFFF',
		fontSize: 16,
	},
	preferenceControl: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	preferenceValue: {
		color: '#E6B800',
		fontSize: 16,
		marginRight: 8,
	},
	toggleButton: {
		backgroundColor: '#3D3D3D',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 4,
	},
	toggleButtonText: {
		color: '#E6B800',
		fontSize: 14,
	},
	currencySelector: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	currencyValue: {
		color: '#E6B800',
		fontSize: 16,
		marginRight: 8,
	},
	currencyButton: {
		backgroundColor: '#3D3D3D',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 4,
		opacity: 0.5, // Disabled for now
	},
	currencyButtonText: {
		color: '#E6B800',
		fontSize: 14,
	},
	dangerButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#3D3D3D',
		padding: 12,
		borderRadius: 8,
		marginTop: 8,
	},
	dangerButtonIcon: {
		marginRight: 8,
	},
	dangerButtonText: {
		color: '#FF4444',
		fontSize: 16,
		fontWeight: 'bold',
	},
	footer: {
		alignItems: 'center',
		padding: 24,
	},
	versionText: {
		color: '#8F8F8F',
		fontSize: 14,
	},
	viewExampleButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 8,
		marginTop: 4,
		marginBottom: 12,
	},
	viewExampleText: {
		color: '#E6B800',
		marginLeft: 8,
	},
	imageExampleContainer: {
		marginTop: 8,
		marginBottom: 8,
		padding: 8,
		backgroundColor: '#3D3D3D',
		borderRadius: 8,
	},
	imageComparisonRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 12,
	},
	imageTypeColumn: {
		flex: 1,
		alignItems: 'center',
	},
	imageTypeTitle: {
		color: '#E6B800',
		fontSize: 16,
		fontWeight: 'bold',
		marginBottom: 8,
	},
	exampleItem: {
		alignItems: 'center',
		marginBottom: 12,
	},
	exampleImage: {
		width: 60,
		height: 60,
		borderRadius: 4,
		backgroundColor: '#2D2D2D',
		marginBottom: 4,
	},
	exampleItemName: {
		color: '#FFFFFF',
		fontSize: 12,
		textAlign: 'center',
	},
	closeButton: {
		backgroundColor: '#2D2D2D',
		padding: 8,
		borderRadius: 4,
		alignItems: 'center',
		marginTop: 12,
	},
	closeButtonText: {
		color: '#E6B800',
		fontSize: 14,
	},
});
