import { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useStore } from '../../store/useStore';
import { Plus } from 'lucide-react-native';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const addToWatchlist = useStore((state) => state.addToWatchlist);

  const searchItems = async (query: string) => {
    if (query.length < 2) return;
    try {
      const response = await fetch(`https://prices.runescape.wiki/api/v1/osrs/search?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching items:', error);
    }
  };

  const handleAddToWatchlist = (item: any) => {
    addToWatchlist({
      id: item.id,
      name: item.name,
      currentPrice: item.current.price,
    });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search items..."
        placeholderTextColor="#8F8F8F"
        value={searchQuery}
        onChangeText={(text) => {
          setSearchQuery(text);
          searchItems(text);
        }}
      />
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            <Text style={styles.itemName}>{item.name}</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleAddToWatchlist(item)}>
              <Plus size={24} color="#E6B800" />
            </TouchableOpacity>
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
  searchInput: {
    backgroundColor: '#2D2D2D',
    padding: 12,
    borderRadius: 8,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2D2D2D',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  addButton: {
    padding: 8,
  },
});