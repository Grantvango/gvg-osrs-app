import React, { useState, useCallback, useRef } from 'react';
import {
	View,
	Text,
	FlatList,
	TouchableOpacity,
	StyleSheet,
	Image,
	TextInput,
	Modal,
	Alert,
	SectionList,
} from 'react-native';
import { useStore } from '../../store/useStore';
import {
	Plus,
	FolderPlus,
	Edit2,
	ChevronDown,
	ChevronRight,
} from 'lucide-react-native';
import { getCachedImageUri } from '../../utils/images';
import { router } from 'expo-router';
import Swipeable from 'react-native-gesture-handler/Swipeable'; // Import Swipeable correctly
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Add the root view

export default function WatchlistScreen() {
	const {
		watchlist,
		removeFromWatchlist,
		watchlistGroups,
		createWatchlistGroup,
		deleteWatchlistGroup,
		moveItemToGroup,
		renameWatchlistGroup,
		getCurrentGroupItems,
	} = useStore();

	const [selectedGroup, setSelectedGroup] = useState('default');
	const [newGroupName, setNewGroupName] = useState('');
	const [showNewGroupModal, setShowNewGroupModal] = useState(false);
	const [renameModalVisible, setRenameModalVisible] = useState(false);
	const [groupToRename, setGroupToRename] = useState('');
	const [newName, setNewName] = useState('');
	const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
		{
			default: true,
		}
	);

	const formatNumber = (num: number) => num.toLocaleString();

	const handleAddNewGroup = () => {
		if (newGroupName.trim() === '') {
			Alert.alert('Error', 'Group name cannot be empty');
			return;
		}

		createWatchlistGroup(newGroupName);
		setNewGroupName('');
		setShowNewGroupModal(false);

		// Auto-expand new group
		setExpandedGroups((prev) => ({
			...prev,
			[newGroupName]: true,
		}));
	};

	const handleRenameGroup = () => {
		if (newName.trim() === '') {
			Alert.alert('Error', 'Group name cannot be empty');
			return;
		}

		renameWatchlistGroup(groupToRename, newName);
		setRenameModalVisible(false);
		setNewName('');
	};

	const handleDeleteGroup = (groupName: string) => {
		if (groupName === 'default') {
			Alert.alert('Cannot Delete', 'The default group cannot be deleted');
			return;
		}

		Alert.alert(
			'Delete Group',
			`Are you sure you want to delete the "${groupName}" group?`,
			[
				{
					text: 'Cancel',
					style: 'cancel',
				},
				{
					text: 'Delete',
					onPress: () => {
						deleteWatchlistGroup(groupName);
						setSelectedGroup('default');
					},
					style: 'destructive',
				},
			]
		);
	};

	const toggleGroupExpand = (groupName: string) => {
		setExpandedGroups((prev) => ({
			...prev,
			[groupName]: !prev[groupName],
		}));
	};

	const openRenameModal = (groupName: string) => {
		setGroupToRename(groupName);
		setNewName(groupName);
		setRenameModalVisible(true);
	};

	// Prepare data for SectionList
	const getSections = useCallback(() => {
		// Only include groups that exist in watchlistGroups
		return watchlistGroups
			.map((group) => ({
				title: group.name,
				data: getCurrentGroupItems(group.name),
				itemCount: getCurrentGroupItems(group.name).length,
				isDefault: group.name === 'default',
			}))
			.filter((section) => {
				// First filter by expanded status
				const isExpanded = expandedGroups[section.title];
				// Then make sure we have items to show (avoid empty sections)
				return isExpanded !== false; // Only filter out explicitly collapsed groups
			});
	}, [watchlistGroups, expandedGroups, getCurrentGroupItems]);

	// Add function to navigate to item details
	const handleItemPress = (item) => {
		router.push({
			pathname: '/item-details',
			params: { id: item.id, name: item.name },
		});
	};

	// Reference for swipeables
	const swipeableRefs = useRef({});

	// Close any open swipeable when a new one is opened
	const closeOpenSwipeable = (id) => {
		Object.keys(swipeableRefs.current).forEach((key) => {
			if (key !== id && swipeableRefs.current[key]) {
				swipeableRefs.current[key].close();
			}
		});
	};

	const renderWatchlistItem = ({ item, index, section }) => {
		// Get image URI for the item, or use a fallback
		const imageUri = getCachedImageUri(item.id) || null;
		const swipeableId = `${item.id}-${index}`;

		// Create the right action component
		const renderRightActions = () => {
			return (
				<TouchableOpacity
					style={styles.deleteAction}
					onPress={() => removeFromWatchlist(item.id)}
				>
					<Text style={styles.deleteActionText}>Remove</Text>
				</TouchableOpacity>
			);
		};

		return (
			<Swipeable
				renderRightActions={renderRightActions}
				onSwipeableOpen={() => closeOpenSwipeable(swipeableId)}
				ref={(ref) => {
					if (ref) {
						swipeableRefs.current[swipeableId] = ref;
					}
				}}
			>
				<TouchableOpacity
					style={styles.watchlistItem}
					onPress={() => handleItemPress(item)}
				>
					{imageUri ? (
						<Image source={{ uri: imageUri }} style={styles.itemImage} />
					) : (
						<View style={[styles.itemImage, styles.placeholderImage]} />
					)}
					<View style={styles.itemDetails}>
						<Text style={styles.itemName} numberOfLines={1}>
							{item.name}
						</Text>
						<Text style={styles.itemPrice}>
							{formatNumber(item.currentPrice)} gp
						</Text>
					</View>
				</TouchableOpacity>
			</Swipeable>
		);
	};

	const renderSectionHeader = ({ section }) => {
		const isDefaultGroup = section.title === 'default';
		const displayTitle = isDefaultGroup ? 'Default Group' : section.title;
		const isExpanded = expandedGroups[section.title] || false;

		return (
			<View style={styles.sectionHeader}>
				<TouchableOpacity
					style={styles.sectionTitleContainer}
					onPress={() => toggleGroupExpand(section.title)}
				>
					{isExpanded ? (
						<ChevronDown size={20} color='#E6B800' />
					) : (
						<ChevronRight size={20} color='#E6B800' />
					)}
					<Text style={styles.sectionTitle}>{displayTitle}</Text>
					<Text style={styles.itemCount}>({section.data.length})</Text>
				</TouchableOpacity>

				{!isDefaultGroup && (
					<View style={styles.groupActions}>
						<TouchableOpacity
							style={styles.groupActionButton}
							onPress={() => {
								setGroupToRename(section.title);
								setNewName(section.title);
								setRenameModalVisible(true);
							}}
						>
							<Edit2 size={16} color='#FFFFFF' />
						</TouchableOpacity>
					</View>
				)}
			</View>
		);
	};

	// Create a simple separator component
	const ItemSeparator = () => <View style={{ height: 1 }} />;

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<View style={styles.container}>
				{watchlist.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Text style={styles.emptyText}>No items in your watchlist</Text>
						<Text style={styles.emptySubtext}>
							Add items by searching or from the All Items screen
						</Text>
					</View>
				) : (
					<View style={styles.content}>
						<SectionList
							sections={getSections()}
							keyExtractor={(item, index) => `${item.id}-${index}`}
							renderItem={renderWatchlistItem}
							renderSectionHeader={renderSectionHeader}
							stickySectionHeadersEnabled={false}
							style={styles.sectionList}
							ItemSeparatorComponent={null} // Remove custom separator
							ListFooterComponent={
								<TouchableOpacity
									style={styles.addGroupButton}
									onPress={() => setShowNewGroupModal(true)}
								>
									<FolderPlus size={16} color='#FFFFFF' />
									<Text style={styles.addGroupText}>Add New Group</Text>
								</TouchableOpacity>
							}
						/>
					</View>
				)}

				{/* New Group Modal */}
				<Modal
					visible={showNewGroupModal}
					transparent={true}
					animationType='slide'
					onRequestClose={() => setShowNewGroupModal(false)}
				>
					<View style={styles.modalOverlay}>
						<View style={styles.modalContent}>
							<Text style={styles.modalTitle}>Create New Group</Text>
							<TextInput
								style={styles.input}
								placeholder='Group Name'
								placeholderTextColor='#8F8F8F'
								value={newGroupName}
								onChangeText={setNewGroupName}
							/>
							<View style={styles.modalButtons}>
								<TouchableOpacity
									style={[styles.modalButton, styles.cancelButton]}
									onPress={() => setShowNewGroupModal(false)}
								>
									<Text style={styles.buttonText}>Cancel</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.modalButton, styles.createButton]}
									onPress={handleAddNewGroup}
								>
									<Text style={styles.buttonText}>Create</Text>
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</Modal>

				{/* Rename Group Modal */}
				<Modal
					visible={renameModalVisible}
					transparent={true}
					animationType='slide'
					onRequestClose={() => setRenameModalVisible(false)}
				>
					<View style={styles.modalOverlay}>
						<View style={styles.modalContent}>
							<Text style={styles.modalTitle}>Rename Group</Text>
							<TextInput
								style={styles.input}
								placeholder='New Group Name'
								placeholderTextColor='#8F8F8F'
								value={newName}
								onChangeText={setNewName}
							/>
							<View style={styles.modalButtons}>
								<TouchableOpacity
									style={[styles.modalButton, styles.cancelButton]}
									onPress={() => setRenameModalVisible(false)}
								>
									<Text style={styles.buttonText}>Cancel</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.modalButton, styles.createButton]}
									onPress={handleRenameGroup}
								>
									<Text style={styles.buttonText}>Rename</Text>
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</Modal>
			</View>
		</GestureHandlerRootView>
	);
}

const styles = StyleSheet.create({
	sectionList: {
		flex: 1,
	},
	emptyContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		flex: 1,
	},
	emptyText: {
		color: '#FFFFFF',
		fontSize: 18,
		marginBottom: 8,
	},
	emptySubtext: {
		color: '#8F8F8F',
		fontSize: 16,
		textAlign: 'center',
	},
	container: {
		flex: 1,
		backgroundColor: '#1A1A1A',
		padding: 16,
	},
	watchlistItem: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#2D2D2D',
		borderRadius: 8,
		padding: 12,
		marginVertical: 6,
	},
	deleteAction: {
		backgroundColor: '#FF4444',
		justifyContent: 'center',
		alignItems: 'center',
		width: 80,
		borderTopRightRadius: 8,
		borderBottomRightRadius: 8,
		marginVertical: 6,
	},
	deleteActionText: {
		color: 'white',
		fontWeight: 'bold',
		padding: 10,
	},
	sectionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		marginTop: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#2D2D2D',
	},
	sectionTitleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	sectionTitle: {
		color: '#E6B800',
		fontSize: 16,
		fontWeight: 'bold',
		marginLeft: 8,
	},
	itemCount: {
		color: '#8F8F8F',
		fontSize: 14,
		marginLeft: 4,
	},
	groupActions: {
		flexDirection: 'row',
	},
	groupActionButton: {
		padding: 8,
		marginLeft: 4,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.7)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	modalContent: {
		width: '80%',
		backgroundColor: '#2D2D2D',
		borderRadius: 12,
		padding: 20,
	},
	modalTitle: {
		color: '#E6B800',
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 16,
		textAlign: 'center',
	},
	input: {
		backgroundColor: '#3D3D3D',
		color: '#FFFFFF',
		borderRadius: 8,
		padding: 12,
		marginBottom: 16,
	},
	modalButtons: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	modalButton: {
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 8,
		flex: 1,
		marginHorizontal: 4,
		alignItems: 'center',
	},
	cancelButton: {
		backgroundColor: '#4D4D4D',
	},
	createButton: {
		backgroundColor: '#E6B800',
	},
	buttonText: {
		fontWeight: 'bold',
		color: '#1A1A1A',
	},
	itemImage: {
		width: 40,
		height: 40,
		borderRadius: 4,
		marginRight: 10,
	},
	placeholderImage: {
		backgroundColor: '#3D3D3D',
	},
	content: {
		flex: 1,
	},
	addGroupButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#2D2D2D',
		borderRadius: 8,
		padding: 12,
		marginVertical: 16,
	},
	addGroupText: {
		color: '#FFFFFF',
		marginLeft: 8,
		fontSize: 16,
	},
	itemDetails: {
		flex: 1,
	},
	itemName: {
		color: '#FFFFFF',
		fontSize: 16,
		marginBottom: 4,
	},
	itemPrice: {
		color: '#E6B800',
		fontSize: 14,
	},
});
