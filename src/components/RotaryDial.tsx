import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';

// Holes run counter-clockwise from the finger stop: "1" is closest, "0" farthest.
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const LETTERS = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ', 'OPER'];

// Angles are in degrees, measured clockwise from 3 o'clock (screen coordinates).
const FINGER_STOP_ANGLE = 45;
const FIRST_HOLE_OFFSET = 60; // angular distance from the stop back to hole "1"
const HOLE_SPACING = 30;
const RETURN_MS_PER_DEG = 3; // ~1s for a full "0", like a real dial

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;
const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const holeRestAngle = (index: number) => FINGER_STOP_ANGLE - FIRST_HOLE_OFFSET - index * HOLE_SPACING;

const circlePath = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

function haptic(fn: () => Promise<void>) {
  if (Platform.OS !== 'web') fn().catch(() => {});
}

type Props = {
  size: number;
  onDigit: (digit: string) => void;
  onOk: () => void;
  okEnabled: boolean;
};

export default function RotaryDial({ size, onDigit, onOk, okEnabled }: Props) {
  const R = size / 2;
  const plateR = R * 0.93;
  const ringR = R * 0.68;
  const holeR = R * 0.14;
  const centerR = R * 0.36;
  const stopHalfWidth = R * 0.03;

  // How far each hole can travel before the finger hits the stop.
  const stopClearance = toDeg(Math.asin(holeR / ringR)) + toDeg(Math.asin(stopHalfWidth / ringR));
  const maxRotation = (index: number) => FIRST_HOLE_OFFSET + index * HOLE_SPACING - stopClearance;

  const holes = useMemo(
    () =>
      DIGITS.map((digit, i) => {
        const a = toRad(holeRestAngle(i));
        return { digit, letters: LETTERS[i], x: R + ringR * Math.cos(a), y: R + ringR * Math.sin(a) };
      }),
    [R, ringR],
  );

  const [rotation] = useState(() => new Animated.Value(0));
  const containerRef = useRef<View>(null);
  const center = useRef({ x: 0, y: 0 });
  const gesture = useRef({ index: -1, lastAngle: 0, rotation: 0, atStop: false });
  const returning = useRef(false);
  const lastPulseStep = useRef(0);

  // A light tick for every hole-width the plate travels on its way back, like dial pulses.
  useEffect(() => {
    const id = rotation.addListener(({ value }) => {
      const step = Math.floor(value / HOLE_SPACING);
      if (returning.current && step < lastPulseStep.current) haptic(Haptics.selectionAsync);
      lastPulseStep.current = step;
    });
    return () => rotation.removeListener(id);
  }, [rotation]);

  const measureCenter = () => {
    containerRef.current?.measureInWindow((x, y, w, h) => {
      center.current = { x: x + w / 2, y: y + h / 2 };
    });
  };

  const angleOf = (e: GestureResponderEvent) =>
    toDeg(Math.atan2(e.nativeEvent.pageY - center.current.y, e.nativeEvent.pageX - center.current.x));

  const holeAt = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.pageX - center.current.x;
    const dy = e.nativeEvent.pageY - center.current.y;
    return holes.findIndex((h) => Math.hypot(dx - (h.x - R), dy - (h.y - R)) <= holeR * 1.25);
  };

  const release = (dial: boolean) => {
    const g = gesture.current;
    if (dial && g.atStop) {
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      onDigit(DIGITS[g.index]);
    }
    g.index = -1;
    returning.current = true;
    Animated.timing(rotation, {
      toValue: 0,
      duration: g.rotation * RETURN_MS_PER_DEG,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      returning.current = false;
      g.rotation = 0;
      measureCenter();
    });
  };

  const onStartShouldSetResponder = (e: GestureResponderEvent) => {
    if (returning.current) return false;
    const index = holeAt(e);
    if (index < 0) return false;
    gesture.current.index = index;
    return true;
  };

  const onResponderGrant = (e: GestureResponderEvent) => {
    const g = gesture.current;
    g.lastAngle = angleOf(e);
    g.rotation = 0;
    g.atStop = false;
    haptic(Haptics.selectionAsync);
  };

  const onResponderMove = (e: GestureResponderEvent) => {
    const g = gesture.current;
    if (g.index < 0) return;
    const angle = angleOf(e);
    const max = maxRotation(g.index);
    g.rotation = clamp(g.rotation + wrap180(angle - g.lastAngle), 0, max);
    g.lastAngle = angle;
    const atStop = g.rotation >= max - 1;
    if (atStop && !g.atStop) haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    g.atStop = atStop;
    rotation.setValue(g.rotation);
  };

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  const platePath =
    circlePath(R, R, plateR) + ' ' + holes.map((h) => circlePath(h.x, h.y, holeR)).join(' ');

  const stopA = toRad(FINGER_STOP_ANGLE);
  const stopFrom = ringR - holeR * 0.4;
  const stopTo = R * 0.99;

  return (
    <View
      ref={containerRef}
      onLayout={measureCenter}
      style={{ width: size, height: size }}
      onStartShouldSetResponder={onStartShouldSetResponder}
      onResponderGrant={onResponderGrant}
      onResponderMove={onResponderMove}
      onResponderTerminationRequest={() => false}
      onResponderRelease={() => release(true)}
      onResponderTerminate={() => release(false)}
    >
      {/* Stationary base: chrome bezel and the number card seen through the holes */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bezel" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#fdfdfd" />
            <Stop offset="0.5" stopColor="#9c9c9c" />
            <Stop offset="1" stopColor="#e4e4e4" />
          </LinearGradient>
        </Defs>
        <Circle cx={R} cy={R} r={R} fill="url(#bezel)" />
        <Circle cx={R} cy={R} r={plateR + R * 0.01} fill="#f4ecd8" />
        {holes.map((h) => (
          <SvgText
            key={h.digit}
            x={h.x}
            y={h.y + holeR * (h.letters ? 0.18 : 0.33)}
            fontSize={holeR * 0.95}
            fontWeight="bold"
            fill="#1d1d1d"
            textAnchor="middle"
          >
            {h.digit}
          </SvgText>
        ))}
        {holes.map((h) =>
          h.letters ? (
            <SvgText
              key={`l${h.digit}`}
              x={h.x}
              y={h.y + holeR * 0.62}
              fontSize={holeR * 0.3}
              fill="#5b4a2e"
              textAnchor="middle"
            >
              {h.letters}
            </SvgText>
          ) : null,
        )}
      </Svg>

      {/* Rotating finger plate */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}
      >
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="plate" cx="40%" cy="35%" r="70%">
              <Stop offset="0" stopColor="#3d3d3d" />
              <Stop offset="1" stopColor="#0b0b0b" />
            </RadialGradient>
          </Defs>
          <Path d={platePath} fill="url(#plate)" fillRule="evenodd" />
          {holes.map((h) => (
            <Circle key={h.digit} cx={h.x} cy={h.y} r={holeR} fill="none" stroke="#6b6b6b" strokeWidth={1.5} />
          ))}
          <Circle cx={R} cy={R} r={plateR} fill="none" stroke="#555" strokeWidth={1.5} />
        </Svg>
      </Animated.View>

      {/* Fixed metal finger stop */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Line
            x1={R + stopFrom * Math.cos(stopA)}
            y1={R + stopFrom * Math.sin(stopA)}
            x2={R + stopTo * Math.cos(stopA)}
            y2={R + stopTo * Math.sin(stopA)}
            stroke="#5a5a5a"
            strokeWidth={stopHalfWidth * 2 + 3}
            strokeLinecap="round"
          />
          <Line
            x1={R + stopFrom * Math.cos(stopA)}
            y1={R + stopFrom * Math.sin(stopA)}
            x2={R + stopTo * Math.cos(stopA)}
            y2={R + stopTo * Math.sin(stopA)}
            stroke="#d9d9d9"
            strokeWidth={stopHalfWidth * 2}
            strokeLinecap="round"
          />
        </Svg>
      </View>

      {/* OK button in the middle of the dial */}
      <Pressable
        onPress={onOk}
        disabled={!okEnabled}
        accessibilityRole="button"
        accessibilityLabel="Call the dialed number"
        style={({ pressed }) => [
          styles.ok,
          {
            width: centerR * 2,
            height: centerR * 2,
            borderRadius: centerR,
            left: R - centerR,
            top: R - centerR,
            backgroundColor: okEnabled ? (pressed ? '#1e5e34' : '#2c7a45') : '#bdb6a6',
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <Text style={[styles.okText, { fontSize: centerR * 0.55 }]}>OK</Text>
        <Text style={[styles.okSub, { fontSize: centerR * 0.16 }]}>CALL</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ok: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#f4ecd8',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  okText: { color: '#fff', fontWeight: '800', letterSpacing: 2 },
  okSub: { color: '#e9f3ec', fontWeight: '600', letterSpacing: 3, marginTop: -2 },
});
