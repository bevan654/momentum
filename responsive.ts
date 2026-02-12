import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 375;

export const s = (size: number) => Math.round((size * SCREEN_WIDTH) / BASE_WIDTH);
