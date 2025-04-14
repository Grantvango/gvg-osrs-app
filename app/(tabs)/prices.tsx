import { useState, useEffect } from 'react';
import {
	View,
	Text,
	ScrollView,
	StyleSheet,
	Image,
	TouchableOpacity,
} from 'react-native';
import { Heart } from 'lucide-react-native';

interface ItemInfo {
	id: string;
	name: string;
	buyLimit: number;
	members: boolean;
	buyPrice: number;
	lastBuyTime: string;
	sellPrice: number;
	lastSellTime: string;
	margin: number;
	dailyVolume: number;
	potentialProfit: number;
	marginVolume: number;
}

export default function PricesScreen() {
	const [items, setItems] = useState<ItemInfo[]>([]);

	useEffect(() => {
		fetchItems();
	}, []);

	const fetchItems = async () => {
		try {
			const priceResponse = await fetch(
				'https://prices.runescape.wiki/api/v1/osrs/latest'
			);
			const priceData = await priceResponse.json();

			const mappingResponse = await fetch(
				'https://prices.runescape.wiki/api/v1/osrs/mapping'
			);
			const mappingData = await mappingResponse.json();
			const itemMapping = new Map(
				mappingData.map((item: any) => [item.id, item])
			);

			const processedItems = Object.entries(priceData.data)
				.map(([id, info]: [string, any]) => {
					const mappingInfo = itemMapping.get(parseInt(id));
					const margin = info.high - info.low;
					const dailyVolume = Math.floor(Math.random() * 1000);

					return {
						id,
						name: mappingInfo?.name || 'Unknown Item',
						buyLimit: mappingInfo?.limit || 0,
						members: mappingInfo?.members || false,
						buyPrice: info.high,
						lastBuyTime: '2 hours ago',
						sellPrice: info.low,
						lastSellTime: '10 minutes ago',
						margin,
						dailyVolume,
						potentialProfit:
							margin * Math.min(dailyVolume, mappingInfo?.limit || 0),
						marginVolume: margin * dailyVolume,
					};
				})
				.sort((a, b) => b.marginVolume - a.marginVolume)
				.slice(0, 20);

			setItems(processedItems);
		} catch (error) {
			console.error('Error fetching items:', error);
		}
	};

	const formatNumber = (num: number) => num.toLocaleString();
	const formatTime = (time: string) => time;

	return (
		<ScrollView style={styles.container} horizontal>
			<ScrollView>
				<View style={styles.table}>
					<View style={styles.headerRow}>
						<Text style={[styles.headerCell, styles.nameCell]}>Name</Text>
						<Text style={styles.headerCell}>Buy limit</Text>
						<Text style={styles.headerCell}>Members</Text>
						<Text style={styles.headerCell}>Buy price</Text>
						<Text style={styles.headerCell}>Last buy</Text>
						<Text style={styles.headerCell}>Sell price</Text>
						<Text style={styles.headerCell}>Last sell</Text>
						<Text style={styles.headerCell}>Margin</Text>
						<Text style={styles.headerCell}>Volume</Text>
						<Text style={styles.headerCell}>Potential profit</Text>
						<Text style={styles.headerCell}>Margin * volume</Text>
						<Text style={styles.headerCell}></Text>
					</View>
					{items.map((item) => (
						<View key={item.id} style={styles.row}>
							<View style={[styles.cell, styles.nameCell]}>
								<Image
									source={{
										uri: `https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${item.id}`,
									}}
									style={styles.itemImage}
								/>
								<Text style={styles.itemName}>{item.name}</Text>
							</View>
							<Text style={styles.cell}>{formatNumber(item.buyLimit)}</Text>
							<Text style={[styles.cell, styles.membersCell]}>
								{item.members ? '★' : ''}
							</Text>
							<Text style={styles.cell}>{formatNumber(item.buyPrice)}</Text>
							<Text style={[styles.cell, styles.timeCell]}>
								{item.lastBuyTime}
							</Text>
							<Text style={styles.cell}>{formatNumber(item.sellPrice)}</Text>
							<Text style={[styles.cell, styles.timeCell]}>
								{item.lastSellTime}
							</Text>
							<Text
								style={[
									styles.cell,
									styles.marginCell,
									item.margin > 0 ? styles.positive : styles.negative,
								]}
							>
								{formatNumber(item.margin)}
							</Text>
							<Text style={styles.cell}>{formatNumber(item.dailyVolume)}</Text>
							<Text style={[styles.cell, styles.profitCell]}>
								{formatNumber(item.potentialProfit)}
							</Text>
							<Text style={[styles.cell, styles.marginVolumeCell]}>
								{formatNumber(item.marginVolume)}
							</Text>
							<TouchableOpacity style={[styles.cell, styles.favoriteCell]}>
								<Heart size={20} color='#8F8F8F' />
							</TouchableOpacity>
						</View>
					))}
				</View>
			</ScrollView>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#1A1A1A',
	},
	table: {
		minWidth: '100%',
	},
	headerRow: {
		flexDirection: 'row',
		backgroundColor: '#2D2D2D',
		borderBottomWidth: 1,
		borderBottomColor: '#3D3D3D',
		paddingVertical: 12,
		paddingHorizontal: 8,
	},
	row: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#2D2D2D',
		paddingVertical: 12,
		paddingHorizontal: 8,
		alignItems: 'center',
	},
	headerCell: {
		color: '#8F8F8F',
		fontSize: 14,
		fontWeight: 'bold',
		width: 100,
		textAlign: 'right',
		paddingHorizontal: 8,
	},
	cell: {
		width: 100,
		color: '#FFFFFF',
		fontSize: 14,
		textAlign: 'right',
		paddingHorizontal: 8,
	},
	nameCell: {
		width: 200,
		flexDirection: 'row',
		alignItems: 'center',
		textAlign: 'left',
	},
	itemImage: {
		width: 32,
		height: 32,
		marginRight: 8,
		backgroundColor: '#2D2D2D',
		borderRadius: 4,
	},
	itemName: {
		color: '#FFFFFF',
		fontSize: 14,
		flex: 1,
	},
	membersCell: {
		color: '#E6B800',
	},
	timeCell: {
		color: '#8F8F8F',
		fontSize: 12,
	},
	marginCell: {
		fontWeight: 'bold',
	},
	positive: {
		color: '#4CAF50',
	},
	negative: {
		color: '#FF4444',
	},
	profitCell: {
		color: '#4CAF50',
	},
	marginVolumeCell: {
		color: '#E6B800',
	},
	favoriteCell: {
		alignItems: 'center',
		justifyContent: 'center',
	},
});
