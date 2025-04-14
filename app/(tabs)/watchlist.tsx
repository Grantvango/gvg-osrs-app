import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useStore } from '../../store/useStore';
import { Trash2 } from 'lucide-react-native';

export default function WatchlistScreen() {
  const { watchlist, removeFromWatchlist } = useStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Watchlist</Text>
      <FlatList
        data={watchlist}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            <View>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.price}>{item.currentPrice.toLocaleString()} gp</Text>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeFromWatchlist(item.id)}>
              <Trash2 size={24} color="#FF4444" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items in your watchlist</Text>
            <Text style={styles.emptySubtext}>Add items from the search tab</Text>
          </View>
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
  title: {
    color: '#E6B800',
    fontSize: 24,
    fontWeight: 'bold',
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
    fontSize: 18,
    marginBottom: 4,
  },
  price: {
    color: '#E6B800',
    fontSize: 16,
  },
  removeButton: {
    padding: 8,
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