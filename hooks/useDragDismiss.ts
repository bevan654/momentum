import { useRef, useCallback, useMemo } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function useDragDismiss(onDismiss: () => void) {
  const panY = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const resetPosition = useCallback(() => {
    panY.setValue(0);
  }, [panY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dy > 8 && gestureState.dy > Math.abs(gestureState.dx);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            panY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 0.5) {
            Animated.timing(panY, {
              toValue: SCREEN_HEIGHT,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              onDismissRef.current();
              panY.setValue(0);
            });
          } else {
            Animated.spring(panY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
      }),
    [panY]
  );

  const animatedStyle = { transform: [{ translateY: panY }] };

  return {
    panHandlers: panResponder.panHandlers,
    animatedStyle,
    resetPosition,
  };
}
