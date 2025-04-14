import { useState, useEffect, useCallback } from 'react';
import {
	View,
	Text,
	FlatList,
	StyleSheet,
	Image,
	TouchableOpacity,
	ActivityIndicator,
	RefreshControl,
} from 'react-native';
import { Heart, TrendingUp, TrendingDown, Search } from 'lucide-react-native';
import { useStore } from '../../store/useStore';
import {
	getItemMapping,
	setItemMapping,
	getLatestPrices,
	setLatestPrices,
	shouldRefreshData,
	markDataRefreshed,
	getProcessedItems,
	setProcessedItems,
} from '../../utils/cache';
import { getCachedImageUri, clearExpiredImages } from '../../utils/images';
import { router } from 'expo-router';

interface ItemInfo {
	id: string;
	name: string;
	buyLimit: number;
	members: boolean;
	buyPrice: number;
	sellPrice: number;
	margin: number;
	dailyVolume: number;
	potentialProfit: number;
	image: string;
}

export default function IndexScreen() {
	const [allItems, setAllItems] = useState<ItemInfo[]>([]);
	const [displayedItems, setDisplayedItems] = useState<ItemInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [page, setPage] = useState(0);
	const [hasMoreItems, setHasMoreItems] = useState(true);
	const { addToWatchlist, isInWatchlist } = useStore();

	const ITEMS_PER_PAGE = 20;

	useEffect(() => {
		fetchItems(false);
		// Clear expired images when component mounts
		clearExpiredImages();
	}, []);

	useEffect(() => {
		loadMoreItems();
	}, [allItems, page]);

	const loadMoreItems = () => {
		if (allItems.length === 0) return;

		const startIndex = page * ITEMS_PER_PAGE;
		const endIndex = startIndex + ITEMS_PER_PAGE;
		const newItems = allItems.slice(startIndex, endIndex);

		if (newItems.length === 0) {
			setHasMoreItems(false);
			return;
		}

		if (page === 0) {
			setDisplayedItems(newItems);
		} else {
			setDisplayedItems((prev) => [...prev, ...newItems]);
		}
	};

	const fetchItems = async (forceRefresh = false) => {
		try {
			setLoading(true);
			let processedItems, priceData, mappingData;
			let needsRefresh = forceRefresh;

			if (!forceRefresh) {
				// First try to get already processed items from cache
				processedItems = await getProcessedItems();

				if (processedItems && processedItems.length > 0) {
					console.log(
						`Found ${processedItems.length} processed items in cache`
					);
					setAllItems(processedItems);
					setPage(0);
					setHasMoreItems(true);
					setLoading(false);

					// Check if we need to refresh in the background
					const shouldRefresh = await shouldRefreshData();
					if (shouldRefresh) {
						console.log(
							'Using cached processed items but refreshing in background'
						);
						backgroundRefresh();
					}
					return;
				}

				// Check if we should do a daily refresh
				needsRefresh = await shouldRefreshData();

				// Try to get data from cache
				priceData = await getLatestPrices();
				mappingData = await getItemMapping();

				console.log(
					`Cache data: prices=${!!priceData}, mapping=${!!mappingData}`
				);

				// If we have cached data but it's time for a daily refresh,
				// we'll use the cached data for now but fetch new data in the background
				if (needsRefresh && priceData && mappingData) {
					// Use cached data first
					await processAndSetItems(priceData, mappingData);
					setLoading(false);
					// Then fetch fresh data in the background
					backgroundRefresh();
					return;
				}
			}

			// If forced refresh or cache missed, fetch from API
			if (needsRefresh || !priceData || !mappingData) {
				console.log('Fetching fresh data from API');
				await fetchAndCacheAllData();
			} else {
				// Use cached data
				console.log('Using cached data');
				await processAndSetItems(priceData, mappingData);
			}
		} catch (error) {
			console.error('Error fetching items:', error);
			// If all fails, show an empty state rather than infinite loading
			setAllItems([]);
			setDisplayedItems([]);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	const backgroundRefresh = async () => {
		try {
			await fetchAndCacheAllData();
			console.log('Background refresh completed');
		} catch (error) {
			console.error('Background refresh failed:', error);
		}
	};

	const fetchAndCacheAllData = async () => {
		try {
			console.log('Fetching latest prices from API');
			// Fetch latest prices
			const priceResponse = await fetch(
				'https://prices.runescape.wiki/api/v1/osrs/latest'
			);

			if (!priceResponse.ok) {
				throw new Error(`Price API responded with ${priceResponse.status}`);
			}

			const priceData = await priceResponse.json();
			if (!priceData || !priceData.data) {
				throw new Error('Invalid price data received from API');
			}

			console.log(
				`Received price data for ${Object.keys(priceData.data).length} items`
			);
			await setLatestPrices(priceData);

			// Fetch mapping data
			console.log('Fetching item mapping from API');
			const mappingResponse = await fetch(
				'https://prices.runescape.wiki/api/v1/osrs/mapping'
			);

			if (!mappingResponse.ok) {
				throw new Error(`Mapping API responded with ${mappingResponse.status}`);
			}

			const mappingData = await mappingResponse.json();
			if (!Array.isArray(mappingData)) {
				throw new Error('Invalid mapping data received from API');
			}

			console.log(`Received mapping data for ${mappingData.length} items`);
			await setItemMapping(mappingData);

			// Process and display the data
			await processAndSetItems(priceData, mappingData);

			// Mark that we've refreshed the data today
			await markDataRefreshed();
		} catch (error) {
			console.error('Failed to fetch and cache data:', error);
			throw error;
		}
	};

	const processAndSetItems = async (priceData: any, mappingData: any) => {
		try {
			console.log('Processing items data...');

			// First check if we already have processed items in cache
			const cachedProcessedItems = await getProcessedItems();
			if (cachedProcessedItems && cachedProcessedItems.length > 0) {
				console.log(
					`Using ${cachedProcessedItems.length} processed items from cache`
				);
				setAllItems(cachedProcessedItems);
				setPage(0);
				setHasMoreItems(true);
				return;
			}

			if (!priceData || !priceData.data) {
				console.error('Invalid price data structure:', priceData);
				return;
			}

			if (!Array.isArray(mappingData)) {
				console.error('Invalid mapping data structure:', mappingData);
				return;
			}

			const itemMapping = new Map(
				mappingData.map((item: any) => [item.id, item])
			);

			console.log(`Created mapping for ${itemMapping.size} items`);

			// Process items in smaller batches to avoid memory issues
			const entries = Object.entries(priceData.data);
			console.log(`Processing ${entries.length} items from price data`);

			const batchSize = 500;
			let allProcessedItems: any[] = [];

			for (let i = 0; i < entries.length; i += batchSize) {
				const batch = entries.slice(i, i + batchSize);
				console.log(
					`Processing batch ${i / batchSize + 1}/${Math.ceil(
						entries.length / batchSize
					)}`
				);

				// Instead of using Promise.all which can cause memory issues
				// process items in small chunks synchronously
				const batchResults = [];
				for (const [id, info] of batch) {
					try {
						const mappingInfo = itemMapping.get(parseInt(id));
						if (!mappingInfo) continue;

						// Skip items with invalid prices
						if (!info.high || !info.low || info.high <= 0 || info.low <= 0)
							continue;

						const margin = info.high - info.low;
						const dailyVolume = Math.floor(Math.random() * 1000) + 100;

						// Get cached image - don't await here to speed things up
						// We'll just use the URL directly and let the Image component handle caching
						const imageUrl = `https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${id}`;

						batchResults.push({
							id,
							name: mappingInfo.name || 'Unknown Item',
							buyLimit: mappingInfo.limit || 0,
							members: mappingInfo.members || false,
							buyPrice: info.high,
							sellPrice: info.low,
							margin,
							dailyVolume,
							potentialProfit:
								margin * Math.min(dailyVolume, mappingInfo.limit || 0),
							image: imageUrl,
						});
					} catch (err) {
						console.error(`Error processing item ${id}:`, err);
					}
				}

				allProcessedItems = [...allProcessedItems, ...batchResults];

				// Every few batches, update the UI to show progress
				if (i % (batchSize * 2) === 0 && allProcessedItems.length > 0) {
					const sortedItems = [...allProcessedItems].sort(
						(a, b) => b.margin - a.margin
					);
					setAllItems(sortedItems);
					setPage(0);
				}

				// Yield to the JS thread to prevent UI freezing
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			// Filter out nulls and sort by margin
			const filteredItems = allProcessedItems.sort(
				(a, b) => b.margin - a.margin
			);

			console.log(`Final processed items: ${filteredItems.length}`);

			if (filteredItems.length === 0) {
				console.warn('No valid items were processed!');
			}

			// Store the processed items in cache for future use
			await setProcessedItems(filteredItems);

			setAllItems(filteredItems as ItemInfo[]);
			setPage(0); // Reset to first page
			setHasMoreItems(true);
		} catch (error) {
			console.error('Error in processing items:', error);
		}
	};

	const onRefresh = useCallback(() => {
		setRefreshing(true);
		fetchItems(true); // Force refresh from API
	}, []);

	const handleLoadMore = () => {
		if (!loading && hasMoreItems) {
			setPage((prevPage) => prevPage + 1);
		}
	};

	const handleAddToWatchlist = (item: ItemInfo) => {
		addToWatchlist({
			id: parseInt(item.id),
			name: item.name,
			currentPrice: item.buyPrice,
		});
	};

	const handleSearchPress = () => {
		router.push('/search');
	};

	const formatNumber = (num: number) => num.toLocaleString();

	if (loading && !refreshing && displayedItems.length === 0) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size='large' color='#E6B800' />
				<Text style={styles.loadingText}>Loading items...</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>All Items</Text>
				<TouchableOpacity
					style={styles.searchButton}
					onPress={handleSearchPress}
				>
					<Search size={22} color='#E6B800' />
				</TouchableOpacity>
			</View>

			<FlatList
				data={displayedItems}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<View style={styles.card}>
						<View style={styles.cardHeader}>
							<Image source={{ uri: item.image }} style={styles.itemImage} />
							<View style={styles.nameContainer}>
								<Text style={styles.itemName}>{item.name}</Text>
								{item.members && <Text style={styles.memberBadge}>P2P</Text>}
							</View>
							<TouchableOpacity
								style={styles.favoriteButton}
								onPress={() => handleAddToWatchlist(item)}
							>
								<Heart
									size={20}
									color={
										isInWatchlist(parseInt(item.id)) ? '#FF4444' : '#E6B800'
									}
									fill={
										isInWatchlist(parseInt(item.id)) ? '#FF4444' : 'transparent'
									}
								/>
							</TouchableOpacity>
						</View>

						<View style={styles.cardContent}>
							<View style={styles.priceContainer}>
								<Text style={styles.priceLabel}>Buy</Text>
								<Text style={styles.priceValue}>
									{formatNumber(item.buyPrice)}
								</Text>
							</View>
							<View style={styles.priceContainer}>
								<Text style={styles.priceLabel}>Sell</Text>
								<Text style={styles.priceValue}>
									{formatNumber(item.sellPrice)}
								</Text>
							</View>
							<View style={styles.marginContainer}>
								<Text style={styles.priceLabel}>Margin</Text>
								<View style={styles.marginValueContainer}>
									{item.margin > 0 ? (
										<TrendingUp size={16} color='#4CAF50' />
									) : (
										<TrendingDown size={16} color='#FF4444' />
									)}
									<Text
										style={[
											styles.marginValue,
											item.margin > 0 ? styles.positive : styles.negative,
										]}
									>
										{formatNumber(item.margin)}
									</Text>
								</View>
							</View>
						</View>

						<View style={styles.cardFooter}>
							<Text style={styles.footerItem}>
								Buy Limit:{' '}
								<Text style={styles.footerValue}>
									{formatNumber(item.buyLimit)}
								</Text>
							</Text>
							<Text style={styles.footerItem}>
								Profit:{' '}
								<Text style={styles.footerValue}>
									{formatNumber(item.potentialProfit)}
								</Text>
							</Text>
						</View>
					</View>
				)}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						colors={['#E6B800']}
						tintColor='#E6B800'
					/>
				}
				onEndReached={handleLoadMore}
				onEndReachedThreshold={0.5}
				ListFooterComponent={
					hasMoreItems && displayedItems.length > 0 ? (
						<ActivityIndicator color='#E6B800' style={styles.footerLoader} />
					) : null
				}
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
	header: {
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
	searchButton: {
		backgroundColor: '#2D2D2D',
		padding: 10,
		borderRadius: 8,
	},
	loadingContainer: {
		flex: 1,
		backgroundColor: '#1A1A1A',
		justifyContent: 'center',
		alignItems: 'center',
	},
	loadingText: {
		color: '#E6B800',
		marginTop: 16,
		fontSize: 16,
	},
	card: {
		backgroundColor: '#2D2D2D',
		borderRadius: 12,
		marginBottom: 16,
		padding: 16,
		elevation: 2,
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
	memberBadge: {
		color: '#E6B800',
		fontSize: 12,
		marginTop: 4,
	},
	favoriteButton: {
		padding: 8,
	},
	cardContent: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 12,
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderTopColor: '#3D3D3D',
		borderBottomColor: '#3D3D3D',
	},
	priceContainer: {
		alignItems: 'center',
		flex: 1,
	},
	priceLabel: {
		color: '#8F8F8F',
		fontSize: 14,
		marginBottom: 4,
	},
	priceValue: {
		color: '#FFFFFF',
		fontSize: 16,
	},
	marginContainer: {
		alignItems: 'center',
		flex: 1,
	},
	marginValueContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	marginValue: {
		fontSize: 16,
		fontWeight: 'bold',
		marginLeft: 4,
	},
	positive: {
		color: '#4CAF50',
	},
	negative: {
		color: '#FF4444',
	},
	cardFooter: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 12,
	},
	footerItem: {
		color: '#8F8F8F',
		fontSize: 14,
	},
	footerValue: {
		color: '#E6B800',
	},
	footerLoader: {
		marginVertical: 20,
	},
});
