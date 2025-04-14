import React, { useState, useCallback } from 'react';
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
	Trash2,
	Plus,
	FolderPlus,
	Edit2,
	ChevronDown,
	ChevronRight,
} from 'lucide-react-native';

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
		return watchlistGroups
			.filter((group) => expandedGroups[group.name])
			.map((group) => ({
				title: group.name,
				data: getCurrentGroupItems(group.name),
				itemCount: getCurrentGroupItems(group.name).length,
				isDefault: group.name === 'default',
			}));
	}, [watchlistGroups, expandedGroups, getCurrentGroupItems]);

	// Render group header
	const renderSectionHeader = useCallback(
		({ section }) => {
			return (
				<View style={styles.groupContainer}>
					<TouchableOpacity
						style={styles.groupHeader}
						onPress={() => toggleGroupExpand(section.title)}
					>
						{expandedGroups[section.title] ? (
							<ChevronDown size={20} color='#E6B800' />
						) : (
							<ChevronRight size={20} color='#E6B800' />
						)}
						<Text style={styles.groupName}>{section.title}</Text>
						<Text style={styles.itemCount}>{section.itemCount} items</Text>

						<View style={styles.groupActions}>
							{!section.isDefault && (
								<>
									<TouchableOpacity
										style={styles.groupAction}
										onPress={() => openRenameModal(section.title)}
									>
										<Edit2 size={16} color='#8F8F8F' />
									</TouchableOpacity>
									<TouchableOpacity
										style={styles.groupAction}
										onPress={() => handleDeleteGroup(section.title)}
									>
										<Trash2 size={16} color='#FF4444' />
									</TouchableOpacity>
								</>
							)}
						</View>
					</TouchableOpacity>
				</View>
			);
		},
		[expandedGroups, toggleGroupExpand, openRenameModal, handleDeleteGroup]
	);

	// Render each group title (including collapsed ones)
	const renderAllGroupHeaders = useCallback(() => {
		return watchlistGroups
			.filter((group) => !expandedGroups[group.name])
			.map((group) => {
				const groupItems = getCurrentGroupItems(group.name);

				return (
					<View key={group.name} style={styles.groupContainer}>
						<TouchableOpacity
							style={styles.groupHeader}
							onPress={() => toggleGroupExpand(group.name)}
						>
							<ChevronRight size={20} color='#E6B800' />
							<Text style={styles.groupName}>{group.name}</Text>
							<Text style={styles.itemCount}>{groupItems.length} items</Text>

							<View style={styles.groupActions}>
								{group.name !== 'default' && (
									<>
										<TouchableOpacity
											style={styles.groupAction}
											onPress={() => openRenameModal(group.name)}
										>
											<Edit2 size={16} color='#8F8F8F' />
										</TouchableOpacity>
										<TouchableOpacity
											style={styles.groupAction}
											onPress={() => handleDeleteGroup(group.name)}
										>
											<Trash2 size={16} color='#FF4444' />
										</TouchableOpacity>
									</>
								)}
							</View>
						</TouchableOpacity>
					</View>
				);
			});
	}, [
		watchlistGroups,
		expandedGroups,
		getCurrentGroupItems,
		toggleGroupExpand,
	]);

	// Render each item
	const renderItem = useCallback(
		({ item, section }) => {
			return (
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Image
							source={{
								uri: `https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${item.id}`,
							}}
							style={styles.itemImage}
						/>
						<View style={styles.nameContainer}>
							<Text style={styles.itemName}>{item.name}</Text>
						</View>
						<View style={styles.actionButtons}>
							{watchlistGroups.length > 1 && (
								<TouchableOpacity
									style={styles.moveButton}
									onPress={() => {
										// Show dropdown to select group
										Alert.alert(
											'Move Item',
											'Select destination group',
											watchlistGroups
												.filter((g) => g.name !== section.title)
												.map((g) => ({
													text: g.name,
													onPress: () => moveItemToGroup(item.id, g.name),
												}))
												.concat([
													{
														text: 'Cancel',
														style: 'cancel',
													},
												])
										);
									}}
								>
									<Text style={styles.moveButtonText}>Move</Text>
								</TouchableOpacity>
							)}
							<TouchableOpacity
								style={styles.removeButton}
								onPress={() => removeFromWatchlist(item.id)}
							>
								<Trash2 size={20} color='#FF4444' />
							</TouchableOpacity>
						</View>
					</View>

					<View style={styles.cardContent}>
						<View style={styles.priceContainer}>
							<Text style={styles.priceLabel}>Current Price</Text>
							<Text style={styles.priceValue}>
								{formatNumber(item.currentPrice)}
							</Text>
						</View>
					</View>
				</View>
			);
		},
		[watchlistGroups, moveItemToGroup, removeFromWatchlist]
	);

	const renderEmptyList = useCallback(() => {
		return (
			<View style={styles.emptyContainer}>
				<Text style={styles.emptyText}>No items in your watchlist</Text>
				<Text style={styles.emptySubtext}>
					Add items by searching or from the All Items screen
				</Text>
			</View>
		);
	}, []);

	const renderEmptySection = useCallback(() => {
		return (
			<View style={styles.emptyGroupContainer}>
				<Text style={styles.emptyGroupText}>No items in this group</Text>
			</View>
		);
	}, []);

	return (
		<View style={styles.container}>
			<View style={styles.titleContainer}>
				<Text style={styles.title}>Your Watchlist</Text>
				<TouchableOpacity
					style={styles.addGroupButton}
					onPress={() => setShowNewGroupModal(true)}
				>
					<FolderPlus size={20} color='#E6B800' />
				</TouchableOpacity>
			</View>

			{watchlist.length === 0 ? (
				renderEmptyList()
			) : (
				<>
					{renderAllGroupHeaders()}
					<SectionList
						sections={getSections()}
						keyExtractor={(item) => item.id.toString()}
						renderItem={renderItem}
						renderSectionHeader={renderSectionHeader}
						renderSectionFooter={(section) =>
							section.section.data.length === 0 ? renderEmptySection() : null
						}
						stickySectionHeadersEnabled={false}
						style={styles.sectionList}
					/>
				</>
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
	emptyGroupContainer: {
		alignItems: 'center',
		padding: 20,
	},
	emptyGroupText: {
		color: '#8F8F8F',
		fontSize: 14,
	},
	container: {
		flex: 1,
		backgroundColor: '#1A1A1A',
		padding: 16,
	},
	titleContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	title: {
		color: '#E6B800',
		fontSize: 24,
		fontWeight: 'bold',
	},
	addGroupButton: {
		backgroundColor: '#2D2D2D',
		padding: 8,
		borderRadius: 8,
	},
	groupContainer: {
		marginBottom: 12,
		backgroundColor: '#2D2D2D',
		borderRadius: 8,
		overflow: 'hidden',
	},
	groupHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		backgroundColor: '#3D3D3D',
	},
	groupName: {
		color: '#E6B800',
		fontSize: 16,
		fontWeight: 'bold',
		marginLeft: 8,
		flex: 1,
	},
	itemCount: {
		color: '#8F8F8F',
		fontSize: 14,
		marginRight: 8,
	},
	groupActions: {
		flexDirection: 'row',
	},
	groupAction: {
		padding: 8,
		marginLeft: 4,
	},
	card: {
		backgroundColor: '#2D2D2D',
		padding: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#3D3D3D',
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 12,
	},
	nameContainer: {
		flex: 1,
		marginLeft: 12,
	},
	itemImage: {
		width: 40,
		height: 40,
		borderRadius: 8,
		backgroundColor: '#3D3D3D',
	},
	itemName: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: 'bold',
	},
	actionButtons: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	moveButton: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 4,
		backgroundColor: '#3D3D3D',
		marginRight: 8,
	},
	moveButtonText: {
		color: '#E6B800',
		fontSize: 12,
	},
	removeButton: {
		padding: 8,
	},
	cardContent: {
		flexDirection: 'row',
		justifyContent: 'center',
		paddingVertical: 12,
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderTopColor: '#3D3D3D',
		borderBottomColor: '#3D3D3D',
	},
	priceContainer: {
		alignItems: 'center',
	},
	priceLabel: {
		color: '#8F8F8F',
		fontSize: 14,
		marginBottom: 4,
	},
	priceValue: {
		color: '#E6B800',
		fontSize: 20,
		fontWeight: 'bold',
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
});
