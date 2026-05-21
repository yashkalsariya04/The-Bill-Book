import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as SQLite from "expo-sqlite";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View
} from "react-native";
import { captureRef } from "react-native-view-shot";

function createEmptyBill() {
  return {
    purchaserName: "",
    sellerName: "",
    quantity: "",
    pricePerBrick: "",
    vehicleNumber: "",
    date: todayText(),
    signature: ""
  };
}

const dbPromise = SQLite.openDatabaseAsync("the_bill_book.db");

export default function App() {
  const [activeTab, setActiveTab] = useState("create");
  const [form, setForm] = useState(createEmptyBill);
  const [bills, setBills] = useState([]);
  const [filter, setFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const previewRef = useRef(null);

  const total = useMemo(() => {
    const quantity = Number(form.quantity) || 0;
    const price = Number(form.pricePerBrick) || 0;
    return quantity * price;
  }, [form.quantity, form.pricePerBrick]);

  const filteredBills = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return bills;
    }
    return bills.filter((bill) => {
      return (
        bill.purchaserName.toLowerCase().includes(query) ||
        bill.sellerName.toLowerCase().includes(query)
      );
    });
  }, [bills, filter]);

  useEffect(() => {
    initDatabase();
  }, []);

  async function initDatabase() {
    const db = await dbPromise;
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchaserName TEXT NOT NULL,
        sellerName TEXT NOT NULL,
        quantity REAL NOT NULL,
        pricePerBrick REAL NOT NULL,
        totalPrice REAL NOT NULL,
        vehicleNumber TEXT NOT NULL,
        billDate TEXT NOT NULL,
        signature TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
    await loadBills();
  }

  async function loadBills() {
    const db = await dbPromise;
    const rows = await db.getAllAsync(
      "SELECT * FROM bills ORDER BY datetime(createdAt) DESC"
    );
    setBills(rows);
  }

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function validateForm() {
    if (!form.purchaserName.trim()) {
      return "Enter the purchaser name.";
    }
    if (!form.sellerName.trim()) {
      return "Enter who is selling the bricks.";
    }
    if (!Number(form.quantity) || Number(form.quantity) <= 0) {
      return "Enter a valid brick quantity.";
    }
    if (!Number(form.pricePerBrick) || Number(form.pricePerBrick) <= 0) {
      return "Enter a valid price per brick.";
    }
    if (!form.vehicleNumber.trim()) {
      return "Enter the vehicle number.";
    }
    if (!form.date.trim()) {
      return "Enter the bill date.";
    }
    if (!form.signature.trim()) {
      return "Enter the signature name.";
    }
    return "";
  }

  async function saveBill() {
    const error = validateForm();
    if (error) {
      Alert.alert("Missing details", error);
      return;
    }

    setIsSaving(true);
    try {
      const db = await dbPromise;
      await db.runAsync(
        `INSERT INTO bills (
          purchaserName,
          sellerName,
          quantity,
          pricePerBrick,
          totalPrice,
          vehicleNumber,
          billDate,
          signature,
          createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          form.purchaserName.trim(),
          form.sellerName.trim(),
          Number(form.quantity),
          Number(form.pricePerBrick),
          total,
          form.vehicleNumber.trim().toUpperCase(),
          form.date.trim(),
          form.signature.trim(),
          new Date().toISOString()
        ]
      );
      await loadBills();
      Alert.alert("Saved", "Bill saved in the local database.");
      setForm(createEmptyBill());
      setActiveTab("bills");
    } catch (error) {
      Alert.alert("Could not save", error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function sharePreview() {
    const error = validateForm();
    if (error) {
      Alert.alert("Missing details", error);
      return;
    }

    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Sharing unavailable", "This device does not support sharing.");
        return;
      }
      const uri = await captureRef(previewRef, {
        format: "png",
        quality: 1,
        result: "tmpfile"
      });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share brick bill"
      });
    } catch (error) {
      Alert.alert("Could not share", error.message);
    }
  }

  function loadBillIntoForm(bill) {
    setForm({
      purchaserName: bill.purchaserName,
      sellerName: bill.sellerName,
      quantity: String(bill.quantity),
      pricePerBrick: String(bill.pricePerBrick),
      vehicleNumber: bill.vehicleNumber,
      date: bill.billDate,
      signature: bill.signature
    });
    setActiveTab("create");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>The Bill Book</Text>
            <Text style={styles.subtitle}>Bricks purchase ledger</Text>
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterNumber}>{bills.length}</Text>
            <Text style={styles.counterLabel}>Bills</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <TabButton
            icon="create-outline"
            label="Create"
            active={activeTab === "create"}
            onPress={() => setActiveTab("create")}
          />
          <TabButton
            icon="receipt-outline"
            label="Bills"
            active={activeTab === "bills"}
            onPress={() => setActiveTab("bills")}
          />
        </View>

        {activeTab === "create" ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.formPanel}>
              <Input
                label="Purchaser name"
                value={form.purchaserName}
                onChangeText={(value) => updateField("purchaserName", value)}
                placeholder="Customer or company name"
              />
              <Input
                label="Seller name"
                value={form.sellerName}
                onChangeText={(value) => updateField("sellerName", value)}
                placeholder="Who is selling"
              />
              <View style={styles.row}>
                <Input
                  label="Quantity"
                  value={form.quantity}
                  onChangeText={(value) => updateField("quantity", value)}
                  placeholder="10000"
                  keyboardType="numeric"
                  style={styles.rowInput}
                />
                <Input
                  label="Price per brick"
                  value={form.pricePerBrick}
                  onChangeText={(value) => updateField("pricePerBrick", value)}
                  placeholder="8.50"
                  keyboardType="decimal-pad"
                  style={styles.rowInput}
                />
              </View>
              <View style={styles.row}>
                <Input
                  label="Vehicle number"
                  value={form.vehicleNumber}
                  onChangeText={(value) => updateField("vehicleNumber", value)}
                  placeholder="MH 12 AB 1234"
                  autoCapitalize="characters"
                  style={styles.rowInput}
                />
                <Input
                  label="Date"
                  value={form.date}
                  onChangeText={(value) => updateField("date", value)}
                  placeholder="YYYY-MM-DD"
                  style={styles.rowInput}
                />
              </View>
              <Input
                label="Signature"
                value={form.signature}
                onChangeText={(value) => updateField("signature", value)}
                placeholder="Signed by"
              />
            </View>

            <BillPreview refValue={previewRef} bill={form} total={total} />

            <View style={styles.actions}>
              <Pressable style={styles.primaryButton} onPress={saveBill} disabled={isSaving}>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>
                  {isSaving ? "Saving..." : "Save Bill"}
                </Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={sharePreview}>
                <Ionicons name="share-social-outline" size={20} color="#16423c" />
                <Text style={styles.secondaryButtonText}>Share Image</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.listScreen}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={20} color="#51635f" />
              <TextInput
                value={filter}
                onChangeText={setFilter}
                placeholder="Filter by purchaser or seller"
                placeholderTextColor="#7f8b88"
                style={styles.searchInput}
              />
            </View>

            <FlatList
              data={filteredBills}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={38} color="#8b938f" />
                  <Text style={styles.emptyTitle}>No bills found</Text>
                  <Text style={styles.emptyText}>
                    Create a bill or adjust the purchaser/seller filter.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable style={styles.billCard} onPress={() => loadBillIntoForm(item)}>
                  <View style={styles.billCardHeader}>
                    <View>
                      <Text style={styles.billCardTitle}>{item.purchaserName}</Text>
                      <Text style={styles.billCardMeta}>Seller: {item.sellerName}</Text>
                    </View>
                    <Text style={styles.billAmount}>{money(item.totalPrice)}</Text>
                  </View>
                  <View style={styles.billCardGrid}>
                    <Meta label="Qty" value={formatNumber(item.quantity)} />
                    <Meta label="Price" value={money(item.pricePerBrick)} />
                    <Meta label="Vehicle" value={item.vehicleNumber} />
                    <Meta label="Date" value={item.billDate} />
                  </View>
                </Pressable>
              )}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TabButton({ active, icon, label, onPress }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.activeTab]} onPress={onPress}>
      <Ionicons name={icon} size={19} color={active ? "#fff" : "#16423c"} />
      <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
    </Pressable>
  );
}

function Input({ label, style, ...props }) {
  return (
    <View style={[styles.inputGroup, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#8c9894"
        style={styles.input}
      />
    </View>
  );
}

function BillPreview({ bill, refValue, total }) {
  return (
    <View collapsable={false} ref={refValue} style={styles.preview}>
      <View style={styles.previewHeader}>
        <View>
          <Text style={styles.previewTitle}>The Bill Book</Text>
          <Text style={styles.previewSubtitle}>Bricks purchase bill</Text>
        </View>
        <Text style={styles.previewDate}>{bill.date || "YYYY-MM-DD"}</Text>
      </View>

      <View style={styles.previewDivider} />

      <View style={styles.previewGrid}>
        <PreviewField label="Purchaser" value={bill.purchaserName || "-"} />
        <PreviewField label="Seller" value={bill.sellerName || "-"} />
        <PreviewField label="Vehicle no." value={bill.vehicleNumber || "-"} />
        <PreviewField label="Signature" value={bill.signature || "-"} />
      </View>

      <View style={styles.totalBox}>
        <PreviewField label="Quantity" value={formatNumber(Number(bill.quantity) || 0)} />
        <PreviewField label="Price per brick" value={money(Number(bill.pricePerBrick) || 0)} />
        <View style={styles.grandTotal}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>{money(total)}</Text>
        </View>
      </View>
    </View>
  );
}

function PreviewField({ label, value }) {
  return (
    <View style={styles.previewField}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

function Meta({ label, value }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  })}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f3ea"
  },
  keyboard: {
    flex: 1
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14
  },
  appName: {
    color: "#143b36",
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: "#5f6e6a",
    fontSize: 14,
    marginTop: 2
  },
  counter: {
    alignItems: "center",
    backgroundColor: "#e3eee9",
    borderColor: "#c7d8d1",
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 68,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  counterNumber: {
    color: "#16423c",
    fontSize: 20,
    fontWeight: "800"
  },
  counterLabel: {
    color: "#53615e",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1
  },
  tabs: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12
  },
  tabButton: {
    alignItems: "center",
    borderColor: "#bfd2cb",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 44,
    justifyContent: "center"
  },
  activeTab: {
    backgroundColor: "#16423c",
    borderColor: "#16423c"
  },
  tabText: {
    color: "#16423c",
    fontSize: 15,
    fontWeight: "800"
  },
  activeTabText: {
    color: "#fff"
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28
  },
  formPanel: {
    gap: 13
  },
  row: {
    flexDirection: "row",
    gap: 12
  },
  rowInput: {
    flex: 1
  },
  inputGroup: {
    gap: 6
  },
  label: {
    color: "#30413d",
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    backgroundColor: "#fffdf8",
    borderColor: "#d9d1c2",
    borderRadius: 8,
    borderWidth: 1,
    color: "#162a27",
    fontSize: 15,
    height: 48,
    paddingHorizontal: 13
  },
  preview: {
    backgroundColor: "#fffdf8",
    borderColor: "#cfc5b3",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 20,
    padding: 18
  },
  previewHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  previewTitle: {
    color: "#143b36",
    fontSize: 23,
    fontWeight: "900"
  },
  previewSubtitle: {
    color: "#61716c",
    fontSize: 13,
    marginTop: 2
  },
  previewDate: {
    color: "#233532",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 5
  },
  previewDivider: {
    backgroundColor: "#d8cdbb",
    height: 1,
    marginVertical: 16
  },
  previewGrid: {
    gap: 12
  },
  previewField: {
    gap: 3
  },
  previewLabel: {
    color: "#6e7a76",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  previewValue: {
    color: "#182d29",
    fontSize: 16,
    fontWeight: "800"
  },
  totalBox: {
    backgroundColor: "#eef5f1",
    borderRadius: 8,
    gap: 11,
    marginTop: 17,
    padding: 14
  },
  grandTotal: {
    alignItems: "center",
    borderTopColor: "#c8d9d2",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12
  },
  grandTotalLabel: {
    color: "#16423c",
    fontSize: 17,
    fontWeight: "900"
  },
  grandTotalValue: {
    color: "#16423c",
    fontSize: 22,
    fontWeight: "900"
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#16423c",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 50,
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#e9f2ee",
    borderColor: "#b8ccc4",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 50,
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: "#16423c",
    fontSize: 15,
    fontWeight: "900"
  },
  listScreen: {
    flex: 1,
    paddingHorizontal: 20
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: "#fffdf8",
    borderColor: "#d9d1c2",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 48,
    paddingHorizontal: 13
  },
  searchInput: {
    color: "#162a27",
    flex: 1,
    fontSize: 15
  },
  listContent: {
    gap: 12,
    paddingBottom: 30,
    paddingTop: 14
  },
  billCard: {
    backgroundColor: "#fffdf8",
    borderColor: "#d9d1c2",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14
  },
  billCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  billCardTitle: {
    color: "#143b36",
    fontSize: 17,
    fontWeight: "900"
  },
  billCardMeta: {
    color: "#63726e",
    fontSize: 13,
    marginTop: 3
  },
  billAmount: {
    color: "#16423c",
    fontSize: 16,
    fontWeight: "900"
  },
  billCardGrid: {
    borderTopColor: "#e2d9ca",
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
    paddingTop: 12
  },
  meta: {
    minWidth: "45%"
  },
  metaLabel: {
    color: "#7a8581",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  metaValue: {
    color: "#233532",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 30,
    paddingTop: 70
  },
  emptyTitle: {
    color: "#223632",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12
  },
  emptyText: {
    color: "#63726e",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
    textAlign: "center"
  }
});
