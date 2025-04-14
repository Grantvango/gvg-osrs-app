import { useState, useEffect } from 'react';
import {
	View,
	Text,
	TextInput,
	FlatList,
	TouchableOpacity,
	StyleSheet,
	ActivityIndicator,
	Image,
} from 'react-native';
import { useStore } from '../../store/useStore';
import { Heart, Search as SearchIcon } from 'lucide-react-native';
import { getCachedImageUri } from '../../utils/images';
import { getItemMapping, getLatestPrices } from '../../utils/cache';
import { router } from 'expo-router';

export default function SearchScreen() {
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [itemMapping, setItemMapping] = useState<any[] | null>(null);
	const [priceData, setPriceData] = useState<any | null>(null);
	const { addToWatchlist, isInWatchlist } = useStore();

	// Load item mapping data when component mounts
	useEffect(() => {
		const loadData = async () => {
			const mapping = await getItemMapping();
			setItemMapping(mapping);

			const prices = await getLatestPrices();
			setPriceData(prices);
		};

		loadData();
	}, []);

	useEffect(() => {
		if (searchQuery.length < 2) {
			setSearchResults([]);
			return;
		}

		const delaySearch = setTimeout(() => {
			searchItems(searchQuery);
		}, 500);

		return () => clearTimeout(delaySearch);
	}, [searchQuery, itemMapping, priceData]);

	const searchItems = async (query: string) => {
		if (query.length < 2) return;

		setIsLoading(true);
		try {
			// If we have item mapping data cached, search locally first
			if (itemMapping && itemMapping.length > 0) {
				const localResults = searchLocalItems(query);
				if (localResults.length > 0) {
					setSearchResults(localResults);
					setIsLoading(false);
					return;
				}
			}

			// Fall back to API search if local search didn't return results
			const response = await fetch(
				`https://prices.runescape.wiki/api/v1/osrs/search?query=${encodeURIComponent(
					query
				)}`
			);
			const data = await response.json();

			// Enhance results with cached image URIs and price data
			const resultsWithImages = await Promise.all(
				data.map(async (item: any) => {
					const imageUri = await getCachedImageUri(item.id.toString());

					// Add high/low prices if available
					let highPrice = item.current?.price || 0;
					let lowPrice = item.current?.price || 0;

					if (priceData && priceData.data && priceData.data[item.id]) {
						highPrice = priceData.data[item.id].high || highPrice;
						lowPrice = priceData.data[item.id].low || lowPrice;
					}

					return {
						...item,
						imageUri,
						highPrice,
						lowPrice,
					};
				})
			);

			setSearchResults(resultsWithImages);
		} catch (error) {
			console.error('Error searching items:', error);
		} finally {
			setIsLoading(false);
		}
	};

	// Search within locally cached item mapping data
	const searchLocalItems = (query: string) => {
		if (!itemMapping) return [];

		const lowerQuery = query.toLowerCase();
		return itemMapping
			.filter((item) => item.name.toLowerCase().includes(lowerQuery))
			.slice(0, 50) // Limit results
			.map((item) => {
				// Get price data if available
				let highPrice = item.value || 0;
				let lowPrice = item.value || 0;

				if (priceData && priceData.data && priceData.data[item.id]) {
					highPrice = priceData.data[item.id].high || highPrice;
					lowPrice = priceData.data[item.id].low || lowPrice;
				}

				return {
					id: item.id,
					name: item.name,
					members: item.members,
					current: { price: item.value || Math.max(highPrice, lowPrice) || 0 },
					highPrice,
					lowPrice,
					limit: item.limit,
					examine: item.examine,
				};
			});
	};

	const handleAddToWatchlist = (item: any) => {
		addToWatchlist({
			id: item.id,
			name: item.name,
			currentPrice: item.current.price,
		});
	};

	const handleItemPress = (item: any) => {
		router.push({
			pathname: '/item-details',
			params: {
				id: item.id,
				name: item.name,
			},
		});
	};

	const formatNumber = (num: number) => num.toLocaleString();

	return (
		<View style={styles.container}>
			<View style={styles.searchContainer}>
				<SearchIcon size={20} color='#8F8F8F' style={styles.searchIcon} />
				<TextInput
					style={styles.searchInput}
					placeholder='Search items...'
					placeholderTextColor='#8F8F8F'
					value={searchQuery}
					onChangeText={(text) => setSearchQuery(text)}
				/>
				{isLoading && <ActivityIndicator size='small' color='#E6B800' />}
			</View>

			<FlatList
				data={searchResults}
				keyExtractor={(item) => item.id.toString()}
				renderItem={({ item }) => (
					<TouchableOpacity
						style={styles.itemContainer}
						onPress={() => handleItemPress(item)}
					>
						<Image
							source={{
								uri:
									item.imageUri ||
									`https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${item.id}`,
							}}
							style={styles.itemImage}
						/>
						<View style={styles.itemInfo}>
							<Text style={styles.itemName}>{item.name}</Text>
							<Text style={styles.itemPrice}>
								{formatNumber(item.current.price)} gp
							</Text>
							{(item.highPrice > 0 || item.lowPrice > 0) && (
								<View style={styles.priceDetails}>
									<Text style={styles.priceLabel}>
										High:{' '}
										<Text style={styles.priceValue}>
											{formatNumber(item.highPrice)}
										</Text>
									</Text>
									<Text style={styles.priceLabel}>
										Low:{' '}
										<Text style={styles.priceValue}>
											{formatNumber(item.lowPrice)}
										</Text>
									</Text>
								</View>
							)}
						</View>
						<TouchableOpacity
							style={[
								styles.addButton,
								isInWatchlist(item.id) && styles.addedButton,
							]}
							onPress={() => handleAddToWatchlist(item)}
						>
							<Heart
								size={24}
								color={isInWatchlist(item.id) ? '#FF4444' : '#E6B800'}
								fill={isInWatchlist(item.id) ? '#FF4444' : 'transparent'}
							/>
						</TouchableOpacity>
					</TouchableOpacity>
				)}
				ListEmptyComponent={() => (
					<View style={styles.emptyContainer}>
						{searchQuery.length > 1 && !isLoading ? (
							<>
								<Text style={styles.emptyText}>No items found</Text>
								<Text style={styles.emptySubtext}>
									Try a different search term
								</Text>
							</>
						) : searchQuery.length === 0 ? (
							<>
								<Text style={styles.emptyText}>Search for OSRS items</Text>
								<Text style={styles.emptySubtext}>
									Type at least 2 characters to search
								</Text>
							</>
						) : null}
					</View>
				)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#1A1A1A',
		padding: 16,
	},
	searchContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#2D2D2D',
		borderRadius: 8,
		paddingHorizontal: 12,
		marginBottom: 16,
	},
	searchIcon: {
		marginRight: 10,
	},
	searchInput: {
		flex: 1,
		padding: 12,
		color: '#FFFFFF',
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#2D2D2D',
		padding: 16,
		borderRadius: 8,
		marginBottom: 8,
	},
	itemImage: {
		width: 40,
		height: 40,
		borderRadius: 8,
		backgroundColor: '#3D3D3D',
	},
	itemInfo: {
		flex: 1,
		marginLeft: 12,
	},
	itemName: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: 'bold',
	},
	itemPrice: {
		color: '#E6B800',
		fontSize: 14,
		marginTop: 4,
	},
	priceDetails: {
		flexDirection: 'row',
		marginTop: 4,
		gap: 12,
	},
	priceLabel: {
		color: '#8F8F8F',
		fontSize: 12,
	},
	priceValue: {
		color: '#FFFFFF',
	},
	addButton: {
		backgroundColor: '#3D3D3D',
		borderRadius: 8,
		padding: 8,
	},
	addedButton: {
		backgroundColor: '#444444',
	},
	emptyContainer: {
		alignItems: 'center',
		marginTop: 32,
	},
	emptyText: {
		color: '#FFFFFF',
		fontSize: 18,
		marginBottom: 8,
	},
	emptySubtext: {
		color: '#8F8F8F',
		fontSize: 16,
	},
});
