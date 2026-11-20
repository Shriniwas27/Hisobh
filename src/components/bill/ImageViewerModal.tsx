import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { BillImage } from '../../types';
import { resolveImagePath } from '../../utils/fileStorage';

interface ImageViewerModalProps {
  visible: boolean;
  images: BillImage[];
  initialIndex?: number;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  images,
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  if (!visible || images.length === 0) return null;

  const handleShare = async () => {
    const currentImg = images[currentIndex];
    if (!currentImg) return;
    const fullUri = resolveImagePath(currentImg.file_path);
    const isAvail = await Sharing.isAvailableAsync();
    if (isAvail) {
      await Sharing.shareAsync(fullUri);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Top Header Bar */}
        <SafeAreaView style={styles.header} edges={['top', 'left', 'right']}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.counterText}>
            {currentIndex + 1} of {images.length}
          </Text>

          <TouchableOpacity onPress={handleShare} style={styles.iconButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="share-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Swipeable & Zoomable Image Slider */}
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setCurrentIndex(index);
          }}
          keyExtractor={(item, index) => item.id ? String(item.id) : String(index)}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const uri = resolveImagePath(item.file_path);
            return (
              <ScrollView
                style={{ width: screenWidth, height: screenHeight }}
                contentContainerStyle={styles.zoomContainer}
                maximumZoomScale={3}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={{ uri }}
                  style={[styles.image, { width: screenWidth, height: screenHeight * 0.75 }]}
                  resizeMode="contain"
                />
              </ScrollView>
            );
          }}
        />

        {/* Bottom thumbnail indicators if multiple images */}
        {images.length > 1 && (
          <View style={styles.paginationDots}>
            {images.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === currentIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 10,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  zoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    alignSelf: 'center',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  activeDot: {
    backgroundColor: '#FFFFFF',
    width: 18,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
