import AsyncStorage from '@react-native-async-storage/async-storage';

export enum ImageType {
	NORMAL = 'normal',
	DETAILED = 'detailed',
}

const IMAGE_CONFIG_KEY = 'osrs_image_config';

interface ImageConfig {
	type: ImageType;
	lastUpdated: number;
}

// Default config settings
const DEFAULT_CONFIG: ImageConfig = {
	type: ImageType.NORMAL,
	lastUpdated: Date.now(),
};

// Get the current image configuration
export const getImageConfig = async (): Promise<ImageConfig> => {
	try {
		const configJson = await AsyncStorage.getItem(IMAGE_CONFIG_KEY);
		if (configJson) {
			return JSON.parse(configJson);
		}
		// If no config exists, set and return default
		await setImageConfig(DEFAULT_CONFIG);
		return DEFAULT_CONFIG;
	} catch (error) {
		console.error('Error getting image config:', error);
		return DEFAULT_CONFIG;
	}
};

// Update the image configuration
export const setImageConfig = async (config: ImageConfig): Promise<void> => {
	try {
		await AsyncStorage.setItem(IMAGE_CONFIG_KEY, JSON.stringify(config));
	} catch (error) {
		console.error('Error setting image config:', error);
	}
};

// Update just the image type
export const setImageType = async (type: ImageType): Promise<void> => {
	const currentConfig = await getImageConfig();
	await setImageConfig({
		...currentConfig,
		type,
		lastUpdated: Date.now(),
	});
};

// Get image URL based on config type and item ID
export const getImageUrl = async (itemId: string | number): Promise<string> => {
	const { type } = await getImageConfig();

	switch (type) {
		case ImageType.DETAILED:
			// First attempt to use the wiki detailed image
			return `https://oldschool.runescape.wiki/images/${itemId}_detail.png`;
		case ImageType.NORMAL:
		default:
			// Use the default RuneScape item database image
			return `https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${itemId}`;
	}
};

// For wiki image, we need to construct the URL using item name (for detailed images)
export const getWikiImageUrl = (
	itemName: string,
	detailed: boolean
): string => {
	// Replace spaces with underscores, and other URL-unfriendly characters
	const formattedName = itemName
		.replace(/ /g, '_')
		.replace(/'/g, '%27')
		.replace(/\(/g, '%28')
		.replace(/\)/g, '%29');

	if (detailed) {
		return `https://oldschool.runescape.wiki/images/${formattedName}_detail.png`;
	} else {
		return `https://oldschool.runescape.wiki/images/${formattedName}.png`;
	}
};
