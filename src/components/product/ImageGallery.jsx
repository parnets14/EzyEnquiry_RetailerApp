import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Text,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { BorderRadius } from '../../theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ImageGallery = ({ images, height = 300 }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);

  const handleScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  const goToImage = (index) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  };

  if (!images || images.length === 0) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderIcon}>🪨</Text>
        <Text style={styles.placeholderText}>No Image Available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item }) => (
          <View style={[styles.imageWrapper, { width: SCREEN_WIDTH, height }]}>
            <Image
              source={{ uri: item }}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        )}
      />

      {/* Dots */}
      {images.length > 1 ? (
        <View style={styles.dotsContainer}>
          {images.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.dot, index === activeIndex && styles.activeDot]}
              onPress={() => goToImage(index)}
            />
          ))}
        </View>
      ) : null}

      {/* Counter */}
      {images.length > 1 ? (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {activeIndex + 1}/{images.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  imageWrapper: {
    backgroundColor: Colors.background,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  activeDot: {
    width: 18,
    backgroundColor: Colors.white,
    borderRadius: 3,
  },
  counter: {
    position: 'absolute',
    top: 12,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.badge,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ImageGallery;
