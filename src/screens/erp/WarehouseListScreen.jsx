/**
 * src/screens/erp/WarehouseListScreen.jsx  (Retailer app)
 *
 * Warehouse list with create / edit / delete and a per-warehouse stock view.
 *   GET    /api/retailer/erp/warehouses            (listWarehouses)
 *   POST   /api/retailer/erp/warehouses            (createWarehouse)
 *   PUT    /api/retailer/erp/warehouses/:id        (updateWarehouse)
 *   DELETE /api/retailer/erp/warehouses/:id        (deleteWarehouse)
 *   GET    /api/retailer/erp/warehouses/:id/stock  (getWarehouseStock)
 *
 * The backend auto-generates `warehouse_code` on create — it is never sent by us.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi } from '../../utils/api';
import {
  ErpHeader, ErpSummaryStrip, ErpCard, ErpSectionLabel, ErpField, ErpInput,
  ErpPicker, ErpLoading, ErpError, ErpEmpty, ErpPrimaryAction, ErpBadge,
  ErpInfoRow, ERP,
} from '../../components/erp';

const TYPES = ['Main', 'Branch', 'Depot', 'Transit', 'Other'];
const UNITS = ['Sq Ft', 'Box', 'Pallet', 'Unit'];

const numOnly = v => String(v ?? '').replace(/[^0-9.]/g, '');

export default function WarehouseListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [warehouses, setWarehouses] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [editing,    setEditing]    = useState(null);   // warehouse | {} for new
  const [stockFor,   setStockFor]   = useState(null);   // warehouse being inspected

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await erpApi.listWarehouses();
      const data = res?.data ?? res;
      setWarehouses(Array.isArray(data) ? data : data?.warehouses ?? []);
    } catch (e) {
      setError(e?.message || 'Failed to load warehouses');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const confirmDelete = (wh) => {
    Alert.alert(
      'Delete warehouse?',
      `${wh.name} will be removed. Stock records tied to it may become unreachable.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await erpApi.deleteWarehouse(wh._id);
              load();
            } catch (e) {
              Alert.alert('Could not delete', e?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const activeCount = warehouses.filter(w => w.is_active !== false).length;

  const renderItem = ({ item }) => (
    <TouchableOpacity style={st.card} onPress={() => setStockFor(item)} activeOpacity={0.85}>
      <View style={st.cardBody}>
        <View style={st.cardTop}>
          <Text style={st.name} numberOfLines={1}>{item.name}</Text>
          {item.warehouse_type ? (
            <ErpBadge label={item.warehouse_type} color={Colors.primary} bg={Colors.primaryBg} />
          ) : null}
        </View>

        <View style={st.metaRow}>
          {item.warehouse_code ? (
            <Text style={st.code}>{item.warehouse_code}</Text>
          ) : null}
          <Text style={st.metaTxt} numberOfLines={1}>
            {[item.city, item.state].filter(Boolean).join(', ') || 'No location set'}
          </Text>
        </View>

        {item.manager || item.contact_person || item.mobile ? (
          <Text style={st.contact} numberOfLines={1}>
            {[item.manager || item.contact_person, item.mobile].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        <View style={st.actions}>
          <TouchableOpacity style={st.actBtn} onPress={() => setEditing(item)}>
            <Ionicons name="create-outline" size={14} color={Colors.primary} />
            <Text style={st.actTxt}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.actBtn} onPress={() => confirmDelete(item)}>
            <Ionicons name="trash-outline" size={14} color={Colors.error} />
            <Text style={[st.actTxt, { color: Colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#B0B5C3" style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Warehouses"
        subtitle="Storage locations"
        onBack={() => navigation.goBack()}>
        <ErpSummaryStrip items={[
          { label: 'Total',  value: warehouses.length },
          { label: 'Active', value: activeCount, color: '#4ADE80' },
        ]} />
      </ErpHeader>

      {loading && !warehouses.length ? (
        <ErpLoading label="Loading warehouses…" />
      ) : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <FlatList
          data={warehouses}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListHeaderComponent={warehouses.length ? <Text style={st.hint}>Tap a warehouse to view its stock.</Text> : null}
          ListEmptyComponent={
            <ErpEmpty
              icon="business-outline"
              title="No warehouses yet"
              subtitle="Add your first warehouse to start tracking stock by location."
            />
          }
        />
      )}

      <View style={[st.fabWrap, { bottom: 16 + insets.bottom }]}>
        <ErpPrimaryAction label="Add Warehouse" onPress={() => setEditing({})} />
      </View>

      {editing ? (
        <WarehouseEditor
          warehouse={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      ) : null}

      {stockFor ? (
        <WarehouseStockSheet warehouse={stockFor} onClose={() => setStockFor(null)} />
      ) : null}
    </SafeAreaView>
  );
}

/* ── Create / edit form ─────────────────────────────────────────────────── */
function WarehouseEditor({ warehouse, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!warehouse._id;

  const [name, setName]       = useState(warehouse.name || '');
  const [type, setType]       = useState(warehouse.warehouse_type || 'Main');
  const [city, setCity]       = useState(warehouse.city || '');
  const [state, setState]     = useState(warehouse.state || '');
  const [address, setAddress] = useState(warehouse.address || '');
  const [manager, setManager] = useState(warehouse.manager || '');
  const [mobile, setMobile]   = useState(warehouse.mobile || '');
  const [capacity, setCapacity] = useState(warehouse.capacity ? String(warehouse.capacity) : '');
  const [unit, setUnit]       = useState(warehouse.unit || 'Sq Ft');

  const [picker, setPicker]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState({});

  const save = async () => {
    if (!name.trim()) { setErrors({ name: 'Name is required' }); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(), warehouse_type: type, city: city.trim(), state: state.trim(),
        address: address.trim(), manager: manager.trim(), mobile: mobile.trim(),
        capacity: capacity ? Number(capacity) : 0, unit,
      };
      if (isEdit) await erpApi.updateWarehouse(warehouse._id, body);
      else        await erpApi.createWarehouse(body);
      onSaved();
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={st.safe} edges={['top']}>
        <ErpHeader
          title={isEdit ? 'Edit Warehouse' : 'Add Warehouse'}
          subtitle={warehouse.warehouse_code || undefined}
          onBack={onClose}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <ErpCard>
              <ErpSectionLabel>Identity</ErpSectionLabel>
              <ErpField label="Name" required error={errors.name}>
                <ErpInput value={name} onChangeText={t => { setName(t); if (errors.name) setErrors({}); }} placeholder="e.g. Main Godown" />
              </ErpField>
              <ErpField label="Type">
                <ErpPicker value={type} onPress={() => setPicker('type')} placeholder="Select type" />
              </ErpField>
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Location</ErpSectionLabel>
              <View style={st.splitRow}>
                <ErpField label="City" half>
                  <ErpInput value={city} onChangeText={setCity} placeholder="City" />
                </ErpField>
                <ErpField label="State" half>
                  <ErpInput value={state} onChangeText={setState} placeholder="State" />
                </ErpField>
              </View>
              <ErpField label="Address">
                <ErpInput value={address} onChangeText={setAddress} placeholder="Street address" multiline style={st.textarea} />
              </ErpField>
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Contact & capacity</ErpSectionLabel>
              <ErpField label="Manager / contact person">
                <ErpInput value={manager} onChangeText={setManager} placeholder="Name" />
              </ErpField>
              <ErpField label="Mobile">
                <ErpInput value={mobile} onChangeText={setMobile} placeholder="Phone" keyboardType="phone-pad" />
              </ErpField>
              <View style={st.splitRow}>
                <ErpField label="Capacity" half>
                  <ErpInput value={capacity} onChangeText={v => setCapacity(numOnly(v))} keyboardType="decimal-pad" placeholder="0" />
                </ErpField>
                <ErpField label="Unit" half>
                  <ErpPicker value={unit} onPress={() => setPicker('unit')} />
                </ErpField>
              </View>
            </ErpCard>
          </ScrollView>

          {/* Pinned action bar — pad past the home indicator / Android nav bar */}
          <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
            <ErpPrimaryAction
              label={saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create warehouse'}
              icon="checkmark"
              onPress={save}
              disabled={saving}
            />
          </View>
        </KeyboardAvoidingView>

        <Modal visible={!!picker} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
          <View style={st.backdrop}>
            <View style={st.sheet}>
              <View style={st.sheetHead}>
                <Text style={st.sheetTitle}>{picker === 'type' ? 'Warehouse type' : 'Capacity unit'}</Text>
                <TouchableOpacity onPress={() => setPicker(null)}>
                  <Ionicons name="close" size={22} color={ERP.muted} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {(picker === 'type' ? TYPES : UNITS).map(opt => {
                  const current = picker === 'type' ? type : unit;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={st.option}
                      onPress={() => {
                        if (picker === 'type') setType(opt); else setUnit(opt);
                        setPicker(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[st.optionTxt, opt === current && st.optionTxtOn]}>{opt}</Text>
                      {opt === current ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

/* ── Warehouse stock sheet ──────────────────────────────────────────────── */
function WarehouseStockSheet({ warehouse, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    erpApi.warehouseStock(warehouse._id)
      .then(r => setData(r?.data ?? r))
      .catch(e => setError(e?.message || 'Failed to load stock'))
      .finally(() => setLoading(false));
  }, [warehouse._id]);

  const stock = Array.isArray(data?.stock) ? data.stock : [];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={st.safe} edges={['top']}>
        <ErpHeader title={warehouse.name} subtitle={warehouse.warehouse_code || 'Warehouse stock'} onBack={onClose} />
        {loading ? <ErpLoading label="Loading stock…" /> : error ? <ErpError message={error} /> : (
          <FlatList
            data={stock}
            keyExtractor={(i, idx) => String(i._id || idx)}
            contentContainerStyle={st.list}
            ListHeaderComponent={
              <ErpCard>
                <ErpSectionLabel>Location</ErpSectionLabel>
                <ErpInfoRow label="Type"    value={warehouse.warehouse_type || '—'} />
                <ErpInfoRow label="City"    value={warehouse.city || '—'} />
                <ErpInfoRow label="State"   value={warehouse.state || '—'} />
                <ErpInfoRow label="Manager" value={warehouse.manager || warehouse.contact_person || '—'} last />
              </ErpCard>
            }
            renderItem={({ item }) => (
              <View style={st.stockRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.stockName} numberOfLines={1}>{item.product_name || item.product_id?.name || 'Product'}</Text>
                  <Text style={st.stockCode} numberOfLines={1}>
                    {item.product_code || item.product_id?.code || ''}
                  </Text>
                </View>
                <View style={st.stockQty}>
                  <Text style={st.stockQtyVal}>{item.available_stock ?? item.current_stock ?? 0}</Text>
                  <Text style={st.stockQtyLbl}>avail</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <ErpEmpty icon="cube-outline" title="No stock here" subtitle="Nothing is currently stored in this warehouse." />
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 14, paddingBottom: 96 },
  content: { padding: 16, paddingBottom: 24 },
  footer: { padding: 16, backgroundColor: ERP.bg },
  hint: { fontSize: 11, color: ERP.muted, marginBottom: 10 },

  card: {
    flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#FFF',
    borderRadius: 14, marginBottom: 10, padding: 13, gap: 8, ...Shadows.sm,
  },
  cardBody: { flex: 1, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 14.5, fontWeight: '800', color: ERP.text, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontSize: 10.5, fontWeight: '700', color: Colors.primary, backgroundColor: Colors.primaryBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  metaTxt: { fontSize: 11.5, color: ERP.muted, flex: 1 },
  contact: { fontSize: 11.5, color: ERP.muted },

  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingRight: 8 },
  actTxt: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  fabWrap: { position: 'absolute', left: 16, right: 16, bottom: 16 },

  splitRow: { flexDirection: 'row', justifyContent: 'space-between' },
  textarea: { height: 72, textAlignVertical: 'top', paddingTop: 11 },

  stockRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 12, padding: 13, marginBottom: 8, ...Shadows.sm,
  },
  stockName: { fontSize: 13.5, fontWeight: '700', color: ERP.text },
  stockCode: { fontSize: 11, color: ERP.muted, marginTop: 2 },
  stockQty: { alignItems: 'flex-end', minWidth: 54 },
  stockQtyVal: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  stockQtyLbl: { fontSize: 9.5, color: ERP.muted },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,22,40,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '55%', paddingBottom: 18, ...Shadows.lg },
  sheetHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: ERP.text },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  optionTxt: { fontSize: 14.5, color: ERP.text },
  optionTxtOn: { fontWeight: '800', color: Colors.primary },
});
