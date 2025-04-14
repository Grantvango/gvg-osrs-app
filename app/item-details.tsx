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
				high: rawData.highPriceVolume || 0,
				low: rawData.lowPriceVolume || 0,
			},
		});
	};

	// Function to get appropriate timestep and URL based on selected period
	const getTimeseriesParams = (period: TimePeriod) => {
		switch (period) {
			case '1D':
				return { timestep: '5m', timeFilter: 24 * 60 * 60 }; // 24 hours, 5-min intervals
			case '7D':
				return { timestep: '1h', timeFilter: 7 * 24 * 60 * 60 }; // 7 days, 1-hour intervals
			case '30D':
				return { timestep: '6h', timeFilter: 30 * 24 * 60 * 60 }; // 30 days, 6-hour intervals
			case '1Y':
				return { timestep: '24h', timeFilter: 365 * 24 * 60 * 60 }; // 1 year, 24-hour intervals
			default:
				return { timestep: '5m', timeFilter: 24 * 60 * 60 }; // Default to 1D
		}
	};

	const loadItemData = async (period: TimePeriod) => {
		setIsLoading(true);
		setError(null);

		// Reset line position when loading new data
		setLinePosition((prev) => ({ ...prev, visible: false }));

		try {
			// Get appropriate parameters for the selected time period
			const { timestep, timeFilter } = getTimeseriesParams(period);
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

			if (timeFilter && filteredTimeseriesData.length > 0) {
				const now = Math.floor(Date.now() / 1000);
				filteredTimeseriesData = filteredTimeseriesData.filter(
					(entry: any) => entry.timestamp >= now - timeFilter
				);
			}

			// Organize timeseries data
			const timestamps = filteredTimeseriesData.map(
				(entry: any) => new Date(entry.timestamp * 1000)
			);

			// Filter out null/zero values for high and low prices
			const highPrices = filteredTimeseriesData.map(
				(entry: any, index: number) => {
					const price = entry.avgHighPrice;
					// If price is null/undefined/0, return null so it won't be plotted
					return price && price > 0 ? price : null;
				}
			);

			const lowPrices = filteredTimeseriesData.map(
				(entry: any, index: number) => {
					const price = entry.avgLowPrice;
					// If price is null/undefined/0, return null so it won't be plotted
					return price && price > 0 ? price : null;
				}
			);

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
						data: highPrices.some((p) => p !== null) ? highPrices : [0],
						color: (opacity = 1) => `rgba(230, 184, 0, ${opacity})`,
						strokeWidth: 2,
						label: 'High Price',
					},
					{
						data: lowPrices.some((p) => p !== null) ? lowPrices : [0],
						color: (opacity = 1) => `rgba(100, 180, 255, ${opacity})`,
						strokeWidth: 2,
						label: 'Low Price',
					},
				],
				legend: ['High Price', 'Low Price'],
				rawData: filteredTimeseriesData, // Store raw data for tooltips
				timestamps: timestamps, // Store timestamps for tooltips
			};

			// Format the volume chart data for bar chart
			// The bar chart will have two datasets: high volume (positive) and low volume (negative)
			const volumeChartData = {
				labels,
				datasets: [
					{
						data: highVolumes, // Positive values
					},
					{
						data: lowVolumes, // Negative values
					},
				],
				// Additional properties for the bar chart
				barColors: ['rgba(230, 184, 0, 1)', 'rgba(100, 180, 255, 1)'],
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

	const chartConfig = {
		backgroundColor: '#2D2D2D',
		backgroundGradientFrom: '#2D2D2D',
		backgroundGradientTo: '#3D3D3D',
		decimalPlaces: 0,
		color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
		labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
		style: {
			borderRadius: 8,
		},
		propsForDots: {
			r: '2',
			strokeWidth: '1',
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
			stroke: 'rgba(255, 255, 255, 0.1)',
		},
		useShadowColorFromDataset: false,
		fillShadowGradient: 'rgba(0, 0, 0, 0)', // Disable fill shadow
		fillShadowGradientOpacity: 0,
	};

	const volumeChartConfig = {
		...chartConfig,
		color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
		formatYLabel: (value: string) => {
			const num = parseInt(value);
			return formatValueWithSuffix(num);
		},
	};

	// Function to handle chart layout for proper dimensions
	const onChartLayout = (event: any) => {
		const { width, height } = event.nativeEvent.layout;
		setChartDimensions({ width, height });
	};

	// Function to handle volume chart layout
	const onVolumeChartLayout = (event: any) => {
		const { width, height } = event.nativeEvent.layout;
		setVolumeChartDimensions({ width, height });
	};

	// JSX for the chart section that can be reused in fullscreen mode
	const renderPriceChart = (
		width: number,
		height: number,
		enableDragging = true
	) => (
		<>
			{isLoading ? (
				<View style={[styles.chartLoadingContainer, { height }]}>
					<ActivityIndicator size='small' color='#E6B800' />
				</View>
			) : timeseriesData?.datasets?.[0]?.data?.length > 0 ? (
				<View
					style={{ width, height }}
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
						withVerticalLines={false}
						withHorizontalLines={true}
						withInnerLines={true}
						withOuterLines={false}
						withVerticalLabels={true}
						withHorizontalLabels={true}
						fromZero={false}
						yAxisInterval={3}
						withDots={true}
						onDataPointClick={handleChartTouch}
						segments={4}
						renderDotContent={({ x, y, index }) => {
							// Only show active tooltip
							if (!tooltipPos.visible || index === undefined) return null;
							if (
								index !==
								timeseriesData.datasets[0].data.findIndex(
									(_, i) => i === tooltipPos.x
								)
							)
								return null;

							return (
								<View
									key={index}
									style={[
										styles.tooltipContainer,
										{
											left: x - 60,
											top: y - 70,
										},
									]}
								>
									<Text style={styles.tooltipLabel}>{tooltipPos.label}</Text>
									<Text style={[styles.tooltipValue, { color: '#E6B800' }]}>
										High: {formatNumber(tooltipPos.highValue)}
									</Text>
									<Text style={[styles.tooltipValue, { color: '#64B4FF' }]}>
										Low: {formatNumber(tooltipPos.lowValue)}
									</Text>
								</View>
							);
						}}
						decorator={() => null}
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
								strokeWidth={1}
								strokeDasharray='5,5'
							/>
							<SvgText
								x={
									linePosition.x > width / 2
										? linePosition.x - 120
										: linePosition.x + 10
								}
								y={20}
								fill='white'
								fontSize='12'
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
								y={40}
								fill='#E6B800'
								fontSize='12'
								fontWeight='bold'
							>
								High: {formatNumber(linePosition.priceData.high)}
							</SvgText>
							<SvgText
								x={
									linePosition.x > width / 2
										? linePosition.x - 120
										: linePosition.x + 10
								}
								y={60}
								fill='#64B4FF'
								fontSize='12'
								fontWeight='bold'
							>
								Low: {formatNumber(linePosition.priceData.low)}
							</SvgText>
						</Svg>
					)}
				</View>
			) : (
				<View style={styles.noChartContainer}>
					<Text style={styles.noChartText}>
						No price history data available
					</Text>
				</View>
			)}
		</>
	);

	// Render volume chart as a bar chart with high/low volumes
	const renderVolumeChart = (
		width: number,
		height: number,
		enableDragging = true
	) => (
		<>
			{isLoading ? (
				<View style={styles.chartLoadingContainer}>
					<ActivityIndicator size='small' color='#64B4FF' />
				</View>
			) : volumeChartData?.datasets?.[0]?.data?.length > 0 ? (
				<View
					style={{ width, height }}
					onLayout={onVolumeChartLayout}
					ref={volumeChartAreaRef}
					{...(enableDragging ? volumePanResponder.panHandlers : {})}
				>
					<ChartKitBarChart
						data={volumeChartData}
						width={width}
						height={height}
						chartConfig={volumeChartConfig}
						style={styles.chart}
						withHorizontalLabels={true}
						fromZero={true}
						showBarTops={false}
						segments={4}
						yAxisInterval={4}
					/>

					{/* Draggable vertical line overlay for volume chart */}
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
								strokeWidth={1}
								strokeDasharray='5,5'
							/>
							<SvgText
								x={
									linePosition.x > width / 2
										? linePosition.x - 120
										: linePosition.x + 10
								}
								y={20}
								fill='#E6B800'
								fontSize='12'
								fontWeight='bold'
							>
								High Vol: {formatNumber(linePosition.volumeData.high)}
							</SvgText>
							<SvgText
								x={
									linePosition.x > width / 2
										? linePosition.x - 120
										: linePosition.x + 10
								}
								y={40}
								fill='#64B4FF'
								fontSize='12'
								fontWeight='bold'
							>
								Low Vol: {formatNumber(linePosition.volumeData.low)}
							</SvgText>
						</Svg>
					)}
				</View>
			) : (
				<View style={styles.noChartContainer}>
					<Text style={styles.noChartText}>No volume data available</Text>
				</View>
			)}
		</>
	);

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
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.header}>
				<TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
					<ArrowLeft size={24} color='#FFFFFF' />
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
						color={isInWatchlist(itemId) ? '#FF4444' : '#E6B800'}
						fill={isInWatchlist(itemId) ? '#FF4444' : 'transparent'}
					/>
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.container}>
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

				<View style={styles.chartContainer}>
					<View style={styles.chartHeaderContainer}>
						<Text style={styles.chartTitle}>
							<TrendingUp size={16} color='#E6B800' /> Price History
						</Text>
						<TouchableOpacity
							style={styles.expandButton}
							onPress={toggleFullscreenChart}
						>
							<Maximize2 size={18} color='#E6B800' />
						</TouchableOpacity>
					</View>

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

					<View style={styles.chartLegend}>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendColor, { backgroundColor: '#E6B800' }]}
							/>
							<Text style={styles.legendText}>High Price</Text>
						</View>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendColor, { backgroundColor: '#64B4FF' }]}
							/>
							<Text style={styles.legendText}>Low Price</Text>
						</View>
					</View>

					<View style={styles.chartWrapper}>
						{renderPriceChart(Dimensions.get('window').width - 32, 180)}
						<Text style={styles.chartHint}>
							Tap and drag on chart to see prices at different points
						</Text>
					</View>

					<View style={styles.chartHeaderContainer}>
						<Text style={styles.chartTitle}>
							<BarChart size={16} color='#64B4FF' /> Volume History
						</Text>
						<TouchableOpacity
							style={styles.expandButton}
							onPress={toggleFullscreenVolumeChart}
						>
							<Maximize2 size={18} color='#64B4FF' />
						</TouchableOpacity>
					</View>

					<View style={styles.chartLegend}>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendColor, { backgroundColor: '#E6B800' }]}
							/>
							<Text style={styles.legendText}>High Volume (Up)</Text>
						</View>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendColor, { backgroundColor: '#64B4FF' }]}
							/>
							<Text style={styles.legendText}>Low Volume (Down)</Text>
						</View>
					</View>

					<View style={styles.chartWrapper}>
						{renderVolumeChart(Dimensions.get('window').width - 32, 150)}
						<Text style={styles.chartHint}>
							Tap and drag on chart to see volume at different points
						</Text>
					</View>
				</View>

				{itemDetails?.details?.examine && (
					<View style={styles.examineContainer}>
						<Text style={styles.examineLabel}>Item Description:</Text>
						<Text style={styles.examineText}>
							{itemDetails.details.examine}
						</Text>
					</View>
				)}
			</ScrollView>

			{/* Fullscreen price chart modal */}
			<Modal
				visible={fullscreenChart}
				animationType='slide'
				transparent={false}
				onRequestClose={() => setFullscreenChart(false)}
			>
				<SafeAreaView style={styles.fullscreenContainer}>
					<View style={styles.fullscreenHeader}>
						<TouchableOpacity
							style={styles.fullscreenBackButton}
							onPress={() => setFullscreenChart(false)}
						>
							<ArrowLeft size={24} color='#FFFFFF' />
							<Text style={styles.fullscreenBackText}>Back</Text>
						</TouchableOpacity>
						<Text style={styles.fullscreenTitle}>
							{itemDetails?.name} - Price
						</Text>
					</View>

					<View style={styles.fullscreenPeriodSelector}>
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

					<View style={styles.chartLegend}>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendColor, { backgroundColor: '#E6B800' }]}
							/>
							<Text style={styles.legendText}>High Price</Text>
						</View>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendColor, { backgroundColor: '#64B4FF' }]}
							/>
							<Text style={styles.legendText}>Low Price</Text>
						</View>
					</View>

					<Text style={styles.dragInstructionText}>
						Touch and drag to compare prices
					</Text>

					<View style={styles.fullscreenChartContainer}>
						{renderPriceChart(
							Dimensions.get('window').width,
							Dimensions.get('window').height - 220,
							true
						)}
					</View>
				</SafeAreaView>
			</Modal>

			{/* Fullscreen volume chart modal */}
			<Modal
				visible={fullscreenVolumeChart}
				animationType='slide'
				transparent={false}
				onRequestClose={() => setFullscreenVolumeChart(false)}
			>
				<SafeAreaView style={styles.fullscreenContainer}>
					<View style={styles.fullscreenHeader}>
						<TouchableOpacity
							style={styles.fullscreenBackButton}
							onPress={() => setFullscreenVolumeChart(false)}
						>
							<ArrowLeft size={24} color='#FFFFFF' />
							<Text style={styles.fullscreenBackText}>Back</Text>
						</TouchableOpacity>
						<Text style={styles.fullscreenTitle}>
							{itemDetails?.name} - Volume
						</Text>
					</View>

					<View style={styles.fullscreenPeriodSelector}>
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

					<View style={styles.chartLegend}>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendColor, { backgroundColor: '#E6B800' }]}
							/>
							<Text style={styles.legendText}>High Volume (Up)</Text>
						</View>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendColor, { backgroundColor: '#64B4FF' }]}
							/>
							<Text style={styles.legendText}>Low Volume (Down)</Text>
						</View>
					</View>

					<Text style={styles.dragInstructionText}>
						Touch and drag to compare volumes
					</Text>

					<View style={styles.fullscreenChartContainer}>
						{renderVolumeChart(
							Dimensions.get('window').width,
							Dimensions.get('window').height - 220,
							true
						)}
					</View>
				</SafeAreaView>
			</Modal>
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
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#2D2D2D',
	},
	chartHeaderContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	chartTitle: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: 'bold',
	},
	expandButton: {
		padding: 4,
		backgroundColor: '#3D3D3D',
		borderRadius: 4,
	},
	periodSelector: {
		flexDirection: 'row',
		backgroundColor: '#2D2D2D',
		borderRadius: 8,
		overflow: 'hidden',
		marginBottom: 16,
	},
	chartLegend: {
		flexDirection: 'row',
		marginBottom: 8,
		justifyContent: 'center',
	},
	legendItem: {
		flexDirection: 'row',
		alignItems: 'center',
		marginHorizontal: 8,
	},
	legendColor: {
		width: 12,
		height: 12,
		borderRadius: 6,
		marginRight: 4,
	},
	legendText: {
		color: '#FFFFFF',
		fontSize: 12,
	},
	chartWrapper: {
		marginBottom: 16,
	},
	periodButton: {
		paddingHorizontal: 8,
		paddingVertical: 6,
		backgroundColor: '#2D2D2D',
		flex: 1,
		alignItems: 'center',
	},
	periodButtonActive: {
		backgroundColor: '#3D3D3D',
	},
	periodButtonText: {
		color: '#8F8F8F',
		fontSize: 12,
		fontWeight: 'bold',
	},
	periodButtonTextActive: {
		color: '#E6B800',
	},
	chart: {
		borderRadius: 8,
		marginBottom: 8,
	},
	chartHint: {
		color: '#8F8F8F',
		fontSize: 12,
		textAlign: 'center',
		marginBottom: 16,
	},
	chartLoadingContainer: {
		height: 180,
		justifyContent: 'center',
		alignItems: 'center',
	},
	noChartContainer: {
		padding: 16,
		alignItems: 'center',
		justifyContent: 'center',
		height: 120,
		backgroundColor: '#2D2D2D',
		borderRadius: 8,
		marginBottom: 16,
	},
	noChartText: {
		color: '#8F8F8F',
		fontSize: 16,
	},
	tooltipContainer: {
		backgroundColor: 'rgba(50, 50, 50, 0.95)',
		borderRadius: 8,
		padding: 8,
		width: 120,
		position: 'absolute',
		zIndex: 99,
	},
	tooltipLabel: {
		color: '#FFFFFF',
		fontSize: 10,
		marginBottom: 4,
	},
	tooltipValue: {
		fontSize: 12,
		fontWeight: 'bold',
	},
	examineContainer: {
		padding: 16,
	},
	examineLabel: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: 'bold',
		marginBottom: 8,
	},
	examineText: {
		color: '#CCCCCC',
		fontSize: 14,
		lineHeight: 20,
	},
	fullscreenContainer: {
		flex: 1,
		backgroundColor: '#1A1A1A',
		padding: 16,
	},
	fullscreenHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 16,
	},
	fullscreenBackButton: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	fullscreenBackText: {
		color: '#FFFFFF',
		marginLeft: 4,
	},
	fullscreenTitle: {
		color: '#FFFFFF',
		fontSize: 18,
		fontWeight: 'bold',
		flex: 1,
		textAlign: 'center',
		marginRight: 32, // Balance with back button
	},
	fullscreenPeriodSelector: {
		flexDirection: 'row',
		backgroundColor: '#2D2D2D',
		borderRadius: 8,
		overflow: 'hidden',
		marginBottom: 16,
	},
	fullscreenChartContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
});
