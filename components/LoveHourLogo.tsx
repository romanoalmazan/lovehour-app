import React from 'react';
import { View, StyleSheet } from 'react-native';

interface LoveHourLogoProps {
  size?: number;
}

const LoveHourLogo: React.FC<LoveHourLogoProps> = ({ size = 120 }) => {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={styles.heartShape}>
        {/* Left hand forming left side of heart */}
        <View style={[styles.hand, styles.handLeft]}>
          <View style={styles.finger} />
          <View style={[styles.finger, styles.fingerMiddle]} />
          <View style={styles.finger} />
        </View>
        
        {/* Smartphone in center */}
        <View style={styles.phone}>
          <View style={styles.phoneScreen}>
            <View style={styles.phoneNotch} />
            <View style={styles.phoneButton} />
          </View>
        </View>
        
        {/* Right hand forming right side of heart */}
        <View style={[styles.hand, styles.handRight]}>
          <View style={styles.finger} />
          <View style={[styles.finger, styles.fingerMiddle]} />
          <View style={styles.finger} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartShape: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  hand: {
    width: 45,
    height: 80,
    backgroundColor: '#D4A574',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#8B6F47',
    position: 'relative',
    overflow: 'visible',
  },
  handLeft: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    marginRight: -8,
    transform: [{ rotate: '-12deg' }, { translateY: 5 }],
  },
  handRight: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    marginLeft: -8,
    transform: [{ rotate: '12deg' }, { translateY: 5 }],
  },
  finger: {
    width: 28,
    height: 18,
    backgroundColor: '#D4A574',
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#8B6F47',
    marginVertical: 3,
    alignSelf: 'flex-end',
    marginRight: 2,
  },
  fingerMiddle: {
    width: 32,
    marginRight: 0,
  },
  phone: {
    width: 28,
    height: 50,
    backgroundColor: '#F5E6D3',
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#8B6F47',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    zIndex: 10,
    position: 'absolute',
    alignSelf: 'center',
  },
  phoneScreen: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  phoneNotch: {
    width: 12,
    height: 3,
    backgroundColor: '#8B6F47',
    borderRadius: 1.5,
    marginTop: 2,
  },
  phoneButton: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B6F47',
    marginBottom: 2,
  },
});

export default LoveHourLogo;