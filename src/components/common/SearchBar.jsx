import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing, Shadows } from '../../theme/spacing';

const SearchBar = ({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search products, designs, brands...',
  onClear,
  editable = true,
  onPress,
  autoFocus = false,
  style,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      style={[styles.wrapper, style]}
    >
      <View style={styles.container} pointerEvents={onPress ? 'none' : 'auto'}>
        <Ionicons name="search-outline" size={18} color={Colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          editable={editable && !onPress}
          autoFocus={autoFocus}
          clearButtonMode="never"
        />
        {value && value.length > 0 ? (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={onClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.clearIcon}>
              <Ionicons name="close" size={11} color={Colors.white} />
            </View>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    minHeight: 48,
    ...Shadows.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    ...Typography.body1,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
  clearBtn: {
    marginLeft: 8,
  },
  clearIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SearchBar;
