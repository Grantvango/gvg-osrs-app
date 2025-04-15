import { useState, useEffect, useRef } from 'react';
import {
	View,
	Text,
	StyleSheet,
	Image,
	ActivityIndicator,
	TouchableOpacity,
	ScrollView,
	Dimensions,
	SafeAreaView,
	Platform,
	StatusBar,
	Modal,
	PanResponder,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useStore } from '../store/useStore';
import {
	Heart,
	ArrowLeft,
	TrendingUp,
	BarChart,
	Maximize2,
} from 'lucide-react-native';
import { getCachedImageUri } from '../utils/images';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	LineChart,
	BarChart as ChartKitBarChart,
} from 'react-native-chart-kit';
import Svg, { Line, Text as SvgText } from 'react-native-svg';

// Cache keys
const CACHE_MAPPING_KEY = 'item_mapping_data';
const CACHE_PRICES_KEY = 'latest_prices_data';
const CACHE_VOLUMES_KEY = 'volumes_data';
const CACHE_TIMESERIES_PREFIX = 'timeseries_';

// Cache expiration time (in ms)
const CACHE_EXPIRY = {
	MAPPING: 24 * 60 * 60 * 1000, // 24 hours
	PRICES: 15 * 60 * 1000, // 15 minutes
	VOLUMES: 60 * 60 * 1000, // 1 hour
	TIMESERIES: 30 * 60 * 1000, // 30 minutes
};

// Updated time period options
type TimePeriod = '1D' | '7D' | '30D' | '1Y';
const TIME_PERIODS: TimePeriod[] = ['1D', '7D', '30D', '1Y'];

// Chart color scheme to match the photo
const CHART_COLORS = {
	PRIMARY: 'rgba(220, 38, 38, 1)', // Red color for main chart line
	SECONDARY: 'rgba(180, 180, 180, 0.5)', // Light gray for secondary data
	GRID: 'rgba(70, 70, 70, 0.5)', // Dark gray for grid lines
	BACKGROUND_DARK: '#000000', // Pure black background
	BACKGROUND_LIGHT: '#1a1a1a', // Slightly lighter black for contrast
	TEXT: '#FFFFFF', // White text
	ACCENT: '#E6B800', // Keep gold accent for highlights
	TOOLTIP_BG: 'rgba(30, 30, 30, 0.85)', // Dark tooltip background
};

// Adding volume chart colors
const VOLUME_COLORS = {
	HIGH: CHART_COLORS.PRIMARY, // Red for high volume (matching chart)
	LOW: 'rgba(46, 204, 113, 1)', // Keep green for low volume
};

export default function ItemDetailScreen() {
	const { id, name } = useLocalSearchParams();
	const itemId = typeof id === 'string' ? id : '';
	const itemName = typeof name === 'string' ? name : 'Item';

	const [isLoading, setIsLoading] = useState(true);
	const [itemDetails, setItemDetails] = useState<any>(null);
	const [timeseriesData, setTimeseriesData] = useState<any>({});
	const [volumeData, setVolumeData] = useState<any>(null);
	const [volumeChartData, setVolumeChartData] = useState<any>({});
	const [error, setError] = useState<string | null>(null);
	const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1D');
	const [fullscreenChart, setFullscreenChart] = useState(false);
	const [fullscreenVolumeChart, setFullscreenVolumeChart] = useState(false);
	const [tooltipPos, setTooltipPos] = useState<{
		x: number;
		y: number;
		visible: boolean;
		highValue: number;
		lowValue: number;
		label: string;
	}>({
		x: 0,
		y: 0,
		visible: false,
		highValue: 0,
		lowValue: 0,
		label: '',
	});

	// New state for tracking line position
	const [linePosition, setLinePosition] = useState<{
		x: number;
		visible: boolean;
		chartWidth: number;
		dataIndex: number;
		priceData: { high: number; low: number; date: string };
		volumeData: { high: number; low: number };
	}>({
		x: 0,
		visible: false,
		chartWidth: 0,
		dataIndex: 0,
		priceData: { high: 0, low: 0, date: '' },
		volumeData: { high: 0, low: 0 },
	});

	// Track chart dimensions
	const [chartDimensions, setChartDimensions] = useState({
		width: Dimensions.get('window').width - 32,
		height: 180,
	});

	const [volumeChartDimensions, setVolumeChartDimensions] = useState({
		width: Dimensions.get('window').width - 32,
		height: 120,
	});

	const chartAreaRef = useRef(null);
	const volumeChartAreaRef = useRef(null);

	const { addToWatchlist, isInWatchlist } = useStore();

	useEffect(() => {
		loadItemData(selectedPeriod);
	}, [itemId, selectedPeriod]);

	// Add this function if it's not already in your code:
	const loadItemImage = async (itemId: string) => {
		try {
			const imageUri = await getCachedImageUri(itemId);
			return imageUri;
		} catch (error) {
			console.error('Error loading image:', error);
			return `https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${itemId}`;
		}
	};

	// Inside your component, update image handling:
	useEffect(() => {
		if (itemDetails && itemId) {
			loadItemImage(itemId).then((imageUri) => {
				setItemDetails((prev: any) => ({
					...prev,
					imageUri,
				}));
			});
		}
	}, [itemId, itemDetails]);

	// Function to create PanResponder for any chart
	const createPanResponder = (isVolumeChart = false) => {
		return PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderGrant: (evt) => {
				const { locationX } = evt.nativeEvent;
				updateLinePosition(locationX, isVolumeChart);
			},
			onPanResponderMove: (evt) => {
				const { locationX } = evt.nativeEvent;
				updateLinePosition(locationX, isVolumeChart);
			},
			onPanResponderRelease: () => {
				// Keep the line visible after release
			},
		});
	};

	// Create pan responders for both charts
	const pricePanResponder = createPanResponder(false);
	const volumePanResponder = createPanResponder(true);

	// Function to update line position and find corresponding data
	const updateLinePosition = (xPos: number, isVolumeChart = false) => {
		if (!timeseriesData.datasets || !timeseriesData.rawData) return;

		// Ensure xPos is within chart bounds
		const chartWidth = isVolumeChart
			? volumeChartDimensions.width
			: chartDimensions.width;
		const boundedX = Math.max(0, Math.min(xPos, chartWidth));

		// Calculate which data point is closest to the line
		const dataPointWidth = chartWidth / (timeseriesData.rawData.length - 1);
		const dataIndex = Math.round(boundedX / dataPointWidth);
		const safeIndex = Math.max(
			0,
			Math.min(dataIndex, timeseriesData.rawData.length - 1)
		);

		// Get the data for this point
		const rawData = timeseriesData.rawData[safeIndex] || {};
		const timestamp = timeseriesData.timestamps
			? timeseriesData.timestamps[safeIndex]
			: null;

		// Format date for display
		let dateLabel = '';
		if (timestamp) {
			const date = new Date(timestamp);
			dateLabel = `${date.toLocaleDateString()} ${date.getHours()}:${date
				.getMinutes()
				.toString()
				.padStart(2, '0')}`;
		}

		setLinePosition({
			x: boundedX,
			visible: true,
			chartWidth,
			dataIndex: safeIndex,
			priceData: {
				high: rawData.avgHighPrice || 0,
				low: rawData.avgLowPrice || 0,
				date: dateLabel,
			},
			volumeData: {
				high: Math.abs(rawData.highPriceVolume || 0),
				low: Math.abs(rawData.lowPriceVolume || 0),
			},
		});
	};

	// Function to get appropriate timestep and URL based on selected period
	const getTimeseriesParams = (period: TimePeriod) => {
		switch (period) {
			case '1D':
				return {
					timestep: '5m',
					timeFilter: 24 * 60 * 60, // 24 hours in seconds
					maxDataPoints: 288, // 24 hours * 12 data points per hour (5-min intervals)
				};
			case '7D':
				return {
					timestep: '1h',
					timeFilter: 7 * 24 * 60 * 60,
					maxDataPoints: 168, // 7 days * 24 hours
				};
			case '30D':
				return {
					timestep: '6h',
					timeFilter: 30 * 24 * 60 * 60,
					maxDataPoints: 120, // 30 days * 4 data points per day (6-hour intervals)
				};
			case '1Y':
				return {
					timestep: '24h',
					timeFilter: 365 * 24 * 60 * 60,
					maxDataPoints: 365, // 365 days (1 per day)
				};
			default:
				return {
					timestep: '5m',
					timeFilter: 24 * 60 * 60,
					maxDataPoints: 288,
				};
		}
	};

	const loadItemData = async (period: TimePeriod) => {
		setIsLoading(true);
		setError(null);

		// Reset line position when loading new data
		setLinePosition((prev) => ({ ...prev, visible: false }));

		try {
			// Get appropriate parameters for the selected time period
			const { timestep, timeFilter, maxDataPoints } =
				getTimeseriesParams(period);
			const timeseriesCacheKey = `${CACHE_TIMESERIES_PREFIX}${itemId}_${period}`;

			// Try to load data from cache first
			const [mappingData, pricesData, volumesData, timeseriesData] =
				await Promise.all([
					fetchWithCache(
						`https://prices.runescape.wiki/api/v1/osrs/mapping`,
						CACHE_MAPPING_KEY,
						CACHE_EXPIRY.MAPPING
					),
					fetchWithCache(
						`https://prices.runescape.wiki/api/v1/osrs/latest`,
						CACHE_PRICES_KEY,
						CACHE_EXPIRY.PRICES
					),
					fetchWithCache(
						`https://prices.runescape.wiki/api/v1/osrs/volumes`,
						CACHE_VOLUMES_KEY,
						CACHE_EXPIRY.VOLUMES
					),
					fetchWithCache(
						`https://prices.runescape.wiki/api/v1/osrs/timeseries?timestep=${timestep}&id=${itemId}`,
						timeseriesCacheKey,
						CACHE_EXPIRY.TIMESERIES
					),
				]);

			// Find item details in mapping
			const itemDetail = Array.isArray(mappingData)
				? mappingData.find((item: any) => item.id === parseInt(itemId))
				: null;

			// Get current price data
			const priceInfo = pricesData?.data?.[itemId] || null;

			// Get volume data
			const volume = volumesData?.data?.[itemId] || null;

			// Filter timeseries data based on the selected period if needed
			let filteredTimeseriesData = timeseriesData?.data || [];

			if (filteredTimeseriesData.length > 0) {
				// First sort by timestamp to ensure newest data is at the end
				filteredTimeseriesData.sort(
					(a: any, b: any) => a.timestamp - b.timestamp
				);

				// If we have more data points than needed, take only the most recent ones
				if (filteredTimeseriesData.length > maxDataPoints) {
					filteredTimeseriesData = filteredTimeseriesData.slice(-maxDataPoints);
				}

				// Apply time filter if needed (ensures data is within the right time window)
				if (timeFilter) {
					const now = Math.floor(Date.now() / 1000);
					filteredTimeseriesData = filteredTimeseriesData.filter(
						(entry: any) => entry.timestamp >= now - timeFilter
					);
				}
			}

			// Organize timeseries data
			const timestamps = filteredTimeseriesData.map(
				(entry: any) => new Date(entry.timestamp * 1000)
			);

			// Filter out null/zero values for high and low prices
			const highPrices = filteredTimeseriesData
				.map((entry: any, index: number) => {
					const price = entry.avgHighPrice;
					// Filter out all null, undefined, 0 values
					return price && price > 0 ? price : null;
				})
				.filter(Boolean); // Remove null/undefined values completely

			const lowPrices = filteredTimeseriesData
				.map((entry: any, index: number) => {
					const price = entry.avgLowPrice;
					// Filter out all null, undefined, 0 values
					return price && price > 0 ? price : null;
				})
				.filter(Boolean); // Remove null/undefined values completely

			// Extract high and low volume data for bar chart
			const highVolumes = filteredTimeseriesData.map((entry: any) =>
				entry.highPriceVolume && entry.highPriceVolume > 0
					? entry.highPriceVolume
					: 0
			);

			const lowVolumes = filteredTimeseriesData.map((entry: any) =>
				entry.lowPriceVolume && entry.lowPriceVolume > 0
					? -entry.lowPriceVolume // Negative for showing below the axis
					: 0
			);

			// Format dates for display based on selected period
			const formatLabels = (date: Date, period: TimePeriod) => {
				switch (period) {
					case '1D':
						return `${date.getHours()}:${date
							.getMinutes()
							.toString()
							.padStart(2, '0')}`;
					case '7D':
						return `${date.getDate()}/${date.getMonth() + 1}`;
					case '30D':
					case '1Y':
						return `${date.getDate()}/${date.getMonth() + 1}`;
					default:
						return `${date.getHours()}:${date
							.getMinutes()
							.toString()
							.padStart(2, '0')}`;
				}
			};

			// Reduce the number of labels to avoid overcrowding
			const skipFactor = Math.max(1, Math.floor(timestamps.length / 6));
			const labels = timestamps.map((date: Date, i: number) =>
				i % skipFactor === 0 ? formatLabels(date, period) : ''
			);

			// Format the price chart data
			const chartData = {
				labels,
				datasets: [
					{
						data: highPrices.length > 0 ? highPrices : [], // Use empty array instead of [0]
						color: (opacity = 5) => CHART_COLORS.PRIMARY,
						strokeWidth: 1,
						label: 'High Price',
						// Use this function to draw discontinuous lines
						withDots: false,
						// Skip rendering the line segment for null/undefined points
						renderDotContent: ({ x, y, index, indexData }: any) => {
							return null; // Don't render any dots
						},
					},
					{
						data: lowPrices.length > 0 ? lowPrices : [], // Use empty array instead of [0]
						color: (opacity = 5) => 'rgba(46, 204, 113, 1)', // Green for low prices
						strokeWidth: 1.5,
						label: 'Low Price',
						withDots: false,
						// Skip rendering the line segment for null/undefined points
						renderDotContent: ({ x, y, index, indexData }: any) => {
							return null; // Don't render any dots
						},
					},
				],
				legend: ['High Price', 'Low Price'],
				rawData: filteredTimeseriesData,
				timestamps: timestamps,
			};

			// Format the volume chart data for bar chart
			// The bar chart will have two datasets: high volume (positive) and low volume (negative)
			const volumeChartData = {
				labels,
				datasets: [
					{
						data: highVolumes, // Positive values
						color: () => VOLUME_COLORS.HIGH,
					},
					{
						data: lowVolumes, // Negative values
						color: () => VOLUME_COLORS.LOW,
					},
				],
				// Additional properties for the bar chart
				barColors: [VOLUME_COLORS.HIGH, VOLUME_COLORS.LOW],
				legend: ['High Volume', 'Low Volume'],
				rawData: filteredTimeseriesData,
			};

			// Get image URI
			const imageUri = await getCachedImageUri(itemId);

			// Combine all data
			setItemDetails({
				id: parseInt(itemId),
				name: itemName,
				details: itemDetail,
				price: priceInfo,
				volume,
				imageUri,
			});

			setTimeseriesData(chartData);
			setVolumeChartData(volumeChartData);
			setVolumeData(volume);
		} catch (err) {
			console.error('Error loading item data:', err);
			setError('Failed to load item data. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	// Helper function to fetch with cache
	const fetchWithCache = async (
		url: string,
		cacheKey: string,
		expiryTime: number
	) => {
		try {
			// Check if we have valid cached data
			const cachedData = await AsyncStorage.getItem(cacheKey);

			if (cachedData) {
				const { data, timestamp } = JSON.parse(cachedData);
				const isExpired = Date.now() - timestamp > expiryTime;

				if (!isExpired) {
					console.log(`Using cached data for ${cacheKey}`);
					return data;
				}
			}

			// If no cache or expired, fetch fresh data
			console.log(`Fetching fresh data for ${cacheKey}`);
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Server responded with ${response.status}`);
			}

			const data = await response.json();

			// Store in cache
			await AsyncStorage.setItem(
				cacheKey,
				JSON.stringify({
					data,
					timestamp: Date.now(),
				})
			);

			return data;
		} catch (err) {
			console.error(`Error fetching ${url}:`, err);

			// If fetch fails, try to use expired cache as fallback
			const cachedData = await AsyncStorage.getItem(cacheKey);
			if (cachedData) {
				console.log(`Using expired cache as fallback for ${cacheKey}`);
				return JSON.parse(cachedData).data;
			}

			throw err;
		}
	};

	const handleAddToWatchlist = () => {
		if (!itemDetails) return;

		addToWatchlist({
			id: itemDetails.id,
			name: itemDetails.name,
			currentPrice: itemDetails.price?.high || itemDetails.price?.low || 0,
		});
	};

	const handleGoBack = () => {
		router.back();
	};

	const formatNumber = (num: number | null | undefined) => {
		if (num === null || num === undefined) return '0';
		return num.toLocaleString();
	};

	// Format values with K and M suffixes
	const formatValueWithSuffix = (value: number) => {
		const absValue = Math.abs(value);
		if (absValue >= 1000000) {
			return `${(value / 1000000).toFixed(1)}M`;
		}
		if (absValue >= 1000) {
			return `${(value / 1000).toFixed(1)}K`;
		}
		return value.toString();
	};

	const handleChartTouch = (data: any) => {
		if (!data || !data.index || !timeseriesData.rawData) return;

		const index = data.index;
		const rawData = timeseriesData.rawData[index] || {};
		const timestamp = timeseriesData.timestamps[index];

		// Format date for tooltip
		let dateLabel = '';
		if (timestamp) {
			const date = new Date(timestamp);
			dateLabel = `${date.toLocaleDateString()} ${date.getHours()}:${date
				.getMinutes()
				.toString()
				.padStart(2, '0')}`;
		}

		setTooltipPos({
			x: data.x,
			y: data.y,
			visible: true,
			highValue: rawData.avgHighPrice || 0,
			lowValue: rawData.avgLowPrice || 0,
			label: dateLabel,
		});

		// Hide tooltip after a few seconds
		setTimeout(() => {
			setTooltipPos((prev) => ({ ...prev, visible: false }));
		}, 3000);
	};

	const toggleFullscreenChart = () => {
		setFullscreenChart(!fullscreenChart);
	};

	const toggleFullscreenVolumeChart = () => {
		setFullscreenVolumeChart(!fullscreenVolumeChart);
	};

	// Update the chart configuration to match the photo style
	const chartConfig = {
		backgroundColor: CHART_COLORS.BACKGROUND_DARK,
		backgroundGradientFrom: CHART_COLORS.BACKGROUND_DARK,
		backgroundGradientTo: CHART_COLORS.BACKGROUND_DARK,
		decimalPlaces: 1,
		color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
		labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.8})`,
		style: {
			borderRadius: 0, // Remove border radius for cleaner look
		},
		propsForDots: {
			r: '0', // No dots
			strokeWidth: '0',
		},
		propsForLabels: {
			fontSize: 10,
		},
		formatYLabel: (value: string) => {
			const num = parseInt(value);
			return formatValueWithSuffix(num);
		},
		propsForBackgroundLines: {
			strokeDasharray: '',
			stroke: CHART_COLORS.GRID,
			strokeWidth: '0.5',
		},
		useShadowColorFromDataset: true,
		fillShadowGradient: CHART_COLORS.PRIMARY,
		fillShadowGradientOpacity: 0.2,
	};

	// JSX for the chart section that can be reused in fullscreen mode
	const renderPriceChart = (
		width: number,
		height: number,
		enableDragging = true
	) => (
		<>
			{isLoading ? (
				<View
					style={[
						styles.chartLoadingContainer,
						{ height, backgroundColor: CHART_COLORS.BACKGROUND_DARK },
					]}
				>
					<ActivityIndicator size='small' color={CHART_COLORS.ACCENT} />
				</View>
			) : timeseriesData?.datasets?.[0]?.data?.length > 0 ? (
				<View
					style={{
						width,
						height,
						backgroundColor: CHART_COLORS.BACKGROUND_DARK,
					}}
					onLayout={onChartLayout}
					ref={chartAreaRef}
					{...(enableDragging ? pricePanResponder.panHandlers : {})}
				>
					<LineChart
						data={timeseriesData}
						width={width}
						height={height}
						chartConfig={chartConfig}
						bezier
						style={styles.chart}
						withVerticalLines={true}
						withHorizontalLines={true}
						withInnerLines={true}
						withOuterLines={false}
						withVerticalLabels={true}
						withHorizontalLabels={true}
						fromZero={false}
						yAxisInterval={4}
						withDots={false}
						onDataPointClick={handleChartTouch}
						segments={4}
						hidePointsAtIndex={[]} // Hide all points
					/>

					{/* Draggable vertical line overlay */}
					{linePosition.visible && (
						<Svg
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								width: width,
								height: height,
							}}
						>
							<Line
								x1={linePosition.x}
								y1={0}
								x2={linePosition.x}
								y2={height}
								stroke='white'
								strokeWidth={0.5}
								strokeDasharray='2,2'
							/>
							<SvgText
								x={
									linePosition.x > width / 2
										? linePosition.x - 120
										: linePosition.x + 10
								}
								y={20}
								fill='white'
								fontSize='10'
								fontWeight='bold'
							>
								{linePosition.priceData.date}
							</SvgText>
							<SvgText
								x={
									linePosition.x > width / 2
										? linePosition.x - 120
										: linePosition.x + 10
								}
								y={38}
								fill={CHART_COLORS.PRIMARY}
								fontSize='11'
								fontWeight='bold'
							>
								{formatNumber(linePosition.priceData.high)}
							</SvgText>
						</Svg>
					)}
				</View>
			) : (
				<View
					style={[
						styles.noChartContainer,
						{ backgroundColor: CHART_COLORS.BACKGROUND_DARK },
					]}
				>
					<Text style={styles.noChartText}>
						No price history data available
					</Text>
				</View>
			)}
		</>
	);

	// Function to handle chart layout for proper dimensions
	const onChartLayout = (event: any) => {
		const { width, height } = event.nativeEvent.layout;
		setChartDimensions({ width, height });
	};

	if (isLoading && !itemDetails) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size='large' color='#E6B800' />
					<Text style={styles.loadingText}>Loading item details...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (error && !itemDetails) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity
						style={styles.retryButton}
						onPress={() => loadItemData(selectedPeriod)}
					>
						<Text style={styles.retryButtonText}>Retry</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
						<ArrowLeft size={24} color='#FFFFFF' />
						<Text style={styles.backButtonText}>Go Back</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView
			style={[
				styles.safeArea,
				{ backgroundColor: CHART_COLORS.BACKGROUND_DARK },
			]}
		>
			<View style={[styles.header, { borderBottomColor: CHART_COLORS.GRID }]}>
				<TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
					<ArrowLeft size={24} color={CHART_COLORS.TEXT} />
				</TouchableOpacity>
				<Text style={styles.headerTitle} numberOfLines={1}>
					{itemDetails?.name}
				</Text>
				<TouchableOpacity
					style={[
						styles.heartButton,
						isInWatchlist(itemId) && styles.heartButtonActive,
					]}
					onPress={handleAddToWatchlist}
				>
					<Heart
						size={24}
						color={isInWatchlist(itemId) ? '#FF4444' : CHART_COLORS.ACCENT}
						fill={isInWatchlist(itemId) ? '#FF4444' : 'transparent'}
					/>
				</TouchableOpacity>
			</View>

			<ScrollView
				style={[
					styles.container,
					{ backgroundColor: CHART_COLORS.BACKGROUND_DARK },
				]}
			>
				<View style={styles.itemInfoContainer}>
					<Image
						source={{
							uri:
								itemDetails?.imageUri ||
								`https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${itemId}`,
						}}
						style={styles.itemImage}
					/>
					<View style={styles.priceInfoContainer}>
						<Text style={styles.itemName}>{itemDetails?.name}</Text>
						<View style={styles.priceRow}>
							<Text style={styles.priceLabel}>High Price:</Text>
							<Text style={styles.priceValue}>
								{formatNumber(itemDetails?.price?.high)} gp
							</Text>
						</View>
						<View style={styles.priceRow}>
							<Text style={styles.priceLabel}>Low Price:</Text>
							<Text style={styles.priceValue}>
								{formatNumber(itemDetails?.price?.low)} gp
							</Text>
						</View>
						{itemDetails?.details?.limit && (
							<View style={styles.priceRow}>
								<Text style={styles.priceLabel}>Buy Limit:</Text>
								<Text style={styles.priceValue}>
									{formatNumber(itemDetails?.details?.limit)}
								</Text>
							</View>
						)}
						{volumeData && (
							<View style={styles.priceRow}>
								<Text style={styles.priceLabel}>Daily Volume:</Text>
								<Text style={styles.priceValue}>
									{formatNumber(volumeData)}
								</Text>
							</View>
						)}
						{itemDetails?.details?.members && (
							<View style={styles.memberBadge}>
								<Text style={styles.memberBadgeText}>Members Item</Text>
							</View>
						)}
					</View>
				</View>
				{/* Display current price prominently */}
				<View style={styles.priceHeader}>
					<Text style={styles.priceLarge}>
						{formatNumber(itemDetails?.price?.high || 0)}
						<Text style={styles.priceUnitLarge}> gp</Text>
					</Text>
				</View>

				{/* Chart section - make it the main focus */}
				<View
					style={[
						styles.chartContainer,
						{ borderBottomColor: CHART_COLORS.GRID },
					]}
				>
					<View style={styles.periodSelector}>
						{TIME_PERIODS.map((period) => (
							<TouchableOpacity
								key={period}
								style={[
									styles.periodButton,
									selectedPeriod === period && styles.periodButtonActive,
								]}
								onPress={() => setSelectedPeriod(period)}
							>
								<Text
									style={[
										styles.periodButtonText,
										selectedPeriod === period && styles.periodButtonTextActive,
									]}
								>
									{period}
								</Text>
							</TouchableOpacity>
						))}
					</View>

					<View style={styles.chartWrapper}>
						{renderPriceChart(Dimensions.get('window').width, 250)}
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	dragInstructionText: {
		color: '#8F8F8F',
		fontSize: 14,
		textAlign: 'center',
		marginBottom: 12,
	},
	lineInfoContainer: {
		position: 'absolute',
		padding: 8,
		backgroundColor: 'rgba(40, 40, 40, 0.9)',
		borderRadius: 8,
		zIndex: 100,
	},
	lineInfoText: {
		color: '#FFFFFF',
		fontSize: 12,
		marginBottom: 4,
	},
	lineInfoValue: {
		fontSize: 14,
		fontWeight: 'bold',
	},
	lineInfoHighValue: {
		color: '#E6B800',
	},
	lineInfoLowValue: {
		color: '#64B4FF',
	},
	safeArea: {
		flex: 1,
		backgroundColor: '#1A1A1A',
		paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
	},
	container: {
		flex: 1,
		backgroundColor: '#1A1A1A',
	},
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
		padding: 16,
	},
	errorText: {
		color: '#FF4444',
		fontSize: 16,
		marginBottom: 16,
		textAlign: 'center',
	},
	retryButton: {
		backgroundColor: '#E6B800',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
		marginBottom: 16,
	},
	retryButtonText: {
		color: '#000000',
		fontWeight: 'bold',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#2D2D2D',
	},
	backButton: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	backButtonText: {
		color: '#FFFFFF',
		marginLeft: 4,
	},
	headerTitle: {
		color: '#FFFFFF',
		fontSize: 18,
		fontWeight: 'bold',
		flex: 1,
		textAlign: 'center',
	},
	heartButton: {
		padding: 8,
		backgroundColor: '#3D3D3D',
		borderRadius: 8,
	},
	heartButtonActive: {
		backgroundColor: '#444444',
	},
	itemInfoContainer: {
		flexDirection: 'row',
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#2D2D2D',
	},
	itemImage: {
		width: 80,
		height: 80,
		borderRadius: 8,
		backgroundColor: '#3D3D3D',
	},
	priceInfoContainer: {
		flex: 1,
		marginLeft: 16,
	},
	itemName: {
		color: '#FFFFFF',
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 8,
	},
	priceRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 4,
	},
	priceLabel: {
		color: '#8F8F8F',
		fontSize: 14,
	},
	priceValue: {
		color: '#E6B800',
		fontSize: 14,
		fontWeight: 'bold',
	},
	memberBadge: {
		backgroundColor: '#3D6E98',
		alignSelf: 'flex-start',
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 4,
		marginTop: 8,
	},
	memberBadgeText: {
		color: '#FFFFFF',
		fontSize: 12,
		fontWeight: 'bold',
	},
	chartContainer: {
		padding: 0,
		borderBottomWidth: 1,
		borderBottomColor: CHART_COLORS.GRID,
	},
	periodSelector: {
		flexDirection: 'row',
		backgroundColor: CHART_COLORS.BACKGROUND_DARK,
		marginVertical: 8,
		paddingHorizontal: 8,
		justifyContent: 'space-between',
	},
	periodButton: {
		paddingHorizontal: 8,
		paddingVertical: 6,
		backgroundColor: CHART_COLORS.BACKGROUND_DARK,
		borderRadius: 4,
	},
	periodButtonActive: {
		backgroundColor: '#333',
	},
	periodButtonText: {
		color: '#8F8F8F',
		fontSize: 12,
		fontWeight: 'bold',
	},
	periodButtonTextActive: {
		color: CHART_COLORS.TEXT,
	},
	chart: {
		borderRadius: 0,
	},
	chartWrapper: {
		marginBottom: 0,
	},
	chartLoadingContainer: {
		height: 250,
		justifyContent: 'center',
		alignItems: 'center',
	},
	priceHeader: {
		alignItems: 'center',
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: CHART_COLORS.GRID,
	},
	priceLarge: {
		color: CHART_COLORS.TEXT,
		fontSize: 32,
		fontWeight: 'bold',
	},
	priceUnitLarge: {
		color: CHART_COLORS.TEXT,
		fontSize: 20,
		fontWeight: 'normal',
	},
	noChartContainer: {
		padding: 16,
		alignItems: 'center',
		justifyContent: 'center',
		height: 250,
		backgroundColor: CHART_COLORS.BACKGROUND_DARK,
		borderRadius: 0,
		marginBottom: 0,
	},
	tooltipContainer: {
		backgroundColor: CHART_COLORS.TOOLTIP_BG,
		borderRadius: 4,
		padding: 8,
		width: 120,
		position: 'absolute',
		zIndex: 99,
	},
});
