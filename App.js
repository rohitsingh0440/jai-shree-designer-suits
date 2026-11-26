import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform,
  SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Linking
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

const STORAGE_KEY = "jai_shree_products_v1";
const GOLD = "#C69A55";
const DARK = "#241711";
const PANEL = "#35231B";
const CREAM = "#F7F0E6";
const MUTED = "#BDAE9D";

const blankForm = {
  name: "", code: "", category: "Designer Suit", type: "single",
  purchase: "", selling: "", mrp: "", discount: "0", minStock: "2",
  supplier: "", purchaseDate: "", quantity: "", image: "", variants: []
};

const money = (v) => `₹${(Number(v) || 0).toLocaleString("en-IN")}`;
const safeNumber = (v) => Math.max(0, Number(v) || 0);

function Field({ label, value, onChangeText, placeholder, keyboardType = "default", editable = true }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={String(value ?? "")} onChangeText={onChangeText}
        placeholder={placeholder || label} placeholderTextColor="#8C7B6A"
        keyboardType={keyboardType} editable={editable}
        style={[styles.input, !editable && { opacity: 0.65 }]}
      />
    </View>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [stockProductId, setStockProductId] = useState(null);
  const [stockDirection, setStockDirection] = useState("in");
  const [stockQty, setStockQty] = useState("1");
  const [stockVariantIndex, setStockVariantIndex] = useState(0);
  const [stockNote, setStockNote] = useState("");
  const [historyProductId, setHistoryProductId] = useState(null);
  const [bills, setBills] = useState([]);
  const [billsLoaded, setBillsLoaded] = useState(false);
  const [billingVisible, setBillingVisible] = useState(false);
  const [receiptBill, setReceiptBill] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState("thermal");
  const [ledgerVisible, setLedgerVisible] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [paymentBill, setPaymentBill] = useState(null);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [cart, setCart] = useState([]);
  const [billingProductSearch, setBillingProductSearch] = useState("");
  const [extraDiscountPercent, setExtraDiscountPercent] = useState("0");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paidAmount, setPaidAmount] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setProducts(JSON.parse(raw));
      } catch (e) {
        Alert.alert("Data load error", "Saved products could not be loaded.");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(products))
      .catch(() => Alert.alert("Save error", "Product data could not be saved."));
  }, [products, loaded]);

  useEffect(() => {
    (async () => {
      try {
        const rawBills = await AsyncStorage.getItem("jai_shree_bills_v1");
        if (rawBills) setBills(JSON.parse(rawBills));
      } catch (e) {
        Alert.alert("Bill data error", "Saved bills could not be loaded.");
      } finally {
        setBillsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (billsLoaded) {
      AsyncStorage.setItem("jai_shree_bills_v1", JSON.stringify(bills))
        .catch(() => Alert.alert("Save error", "Bill data could not be saved."));
    }
  }, [bills, billsLoaded]);

  const nextCode = useMemo(() => {
    const nums = products.map(p => {
      const m = String(p.code || "").match(/^JS(\d+)$/i);
      return m ? Number(m[1]) : 0;
    });
    return `JS${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
  }, [products]);

  const totalPieces = products.reduce((sum, p) =>
    sum + (p.type === "variant"
      ? (p.variants || []).reduce((s, v) => s + safeNumber(v.quantity), 0)
      : safeNumber(p.quantity)), 0);

  const billBalance = (bill) => Math.max(0, safeNumber(bill.due) - (bill.paymentHistory || []).reduce((sum, item) => sum + safeNumber(item.amount), 0));
  const totalOutstanding = bills.reduce((sum, bill) => sum + billBalance(bill), 0);
  const ledgerCustomers = Object.values(bills.reduce((groups, bill) => {
    const key = bill.customerMobile || bill.customerName || "Unknown";
    if (!groups[key]) groups[key] = { key, name: bill.customerName || "Customer", mobile: bill.customerMobile || "", bills: [], due: 0, total: 0 };
    groups[key].bills.push(bill); groups[key].due += billBalance(bill); groups[key].total += safeNumber(bill.total);
    return groups;
  }, {})).sort((a,b) => b.due-a.due);

  const lowStock = products.filter(p => {
    const qty = p.type === "variant"
      ? (p.variants || []).reduce((s, v) => s + safeNumber(v.quantity), 0)
      : safeNumber(p.quantity);
    return qty <= safeNumber(p.minStock);
  }).length;

  const filtered = products.filter(p =>
    `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(search.toLowerCase())
  );

  const setField = (key, value) => setForm(old => ({ ...old, [key]: value }));

  function openAdd() {
    setEditingId(null);
    setForm({ ...blankForm, code: nextCode });
    setModalVisible(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm({
      ...blankForm, ...item,
      variants: item.variants ? item.variants.map(v => ({...v})) : []
    });
    setModalVisible(true);
  }

  async function chooseImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo access to select a product image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, quality: 0.75, aspect: [3, 4]
    });
    if (!result.canceled && result.assets?.[0]?.uri) setField("image", result.assets[0].uri);
  }

  function addVariant() {
    setField("variants", [...form.variants, { colour: "", size: "", quantity: "1" }]);
  }
  function updateVariant(index, key, value) {
    const updated = form.variants.map((v, i) => i === index ? { ...v, [key]: value } : v);
    setField("variants", updated);
  }
  function removeVariant(index) {
    setField("variants", form.variants.filter((_, i) => i !== index));
  }

  function saveProduct() {
    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();
    if (!name || !code || !form.purchase || !form.selling) {
      Alert.alert("Required details", "Please enter Product Name, Product Code, Purchase Price and Selling Price.");
      return;
    }
    if (products.some(p => p.code.toUpperCase() === code && p.id !== editingId)) {
      Alert.alert("Duplicate code", "This Product Code already exists. Please use another code.");
      return;
    }
    if (form.type === "variant" && form.variants.length === 0) {
      Alert.alert("Add variants", "Please add at least one Colour / Size variant.");
      return;
    }
    if (form.type === "variant" && form.variants.some(v => !v.colour.trim() || !v.size.trim())) {
      Alert.alert("Variant details", "Please enter Colour and Size for every variant.");
      return;
    }
    const product = {
      ...form, name, code, id: editingId || String(Date.now()),
      purchase: safeNumber(form.purchase), selling: safeNumber(form.selling),
      mrp: safeNumber(form.mrp), discount: safeNumber(form.discount),
      minStock: safeNumber(form.minStock), quantity: safeNumber(form.quantity),
      variants: form.type === "variant"
        ? form.variants.map(v => ({ ...v, quantity: safeNumber(v.quantity) }))
        : []
    };
    setSaving(true);
    setProducts(old => editingId ? old.map(p => p.id === editingId ? product : p) : [product, ...old]);
    setSaving(false);
    setModalVisible(false);
    setForm(blankForm);
  }

  function deleteProduct(item) {
    Alert.alert("Delete product?", `${item.name} (${item.code}) will be removed from this phone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setProducts(old => old.filter(p => p.id !== item.id)) }
    ]);
  }

  function stockOf(p) {
    return p.type === "variant"
      ? (p.variants || []).reduce((s, v) => s + safeNumber(v.quantity), 0)
      : safeNumber(p.quantity);
  }

  function openStock(item, direction) {
    setStockProductId(item.id);
    setStockDirection(direction);
    setStockQty("1");
    setStockNote("");
    setStockVariantIndex(0);
    setStockModalVisible(true);
  }

  function applyStockMovement() {
    const qty = Math.floor(Number(stockQty));
    if (!qty || qty < 1) {
      Alert.alert("Quantity required", "Please enter a quantity greater than zero.");
      return;
    }
    const product = products.find(p => p.id === stockProductId);
    if (!product) return;
    const isVariant = product.type === "variant";
    const variant = isVariant ? product.variants[stockVariantIndex] : null;
    if (isVariant && !variant) {
      Alert.alert("Select variant", "Please select a colour and size.");
      return;
    }
    const current = isVariant ? safeNumber(variant.quantity) : safeNumber(product.quantity);
    if (stockDirection === "out" && qty > current) {
      Alert.alert("Not enough stock", `Available stock is ${current} pieces.`);
      return;
    }
    const delta = stockDirection === "in" ? qty : -qty;
    const variantLabel = variant ? `${variant.colour} / ${variant.size}` : "Single design";
    const movement = {
      id: String(Date.now()),
      direction: stockDirection,
      quantity: qty,
      variantLabel,
      note: stockNote.trim(),
      date: new Date().toLocaleString("en-IN")
    };
    setProducts(old => old.map(p => {
      if (p.id !== stockProductId) return p;
      if (p.type === "variant") {
        return {
          ...p,
          variants: p.variants.map((v, i) =>
            i === stockVariantIndex ? { ...v, quantity: Math.max(0, safeNumber(v.quantity) + delta) } : v
          ),
          stockHistory: [movement, ...(p.stockHistory || [])]
        };
      }
      return {
        ...p,
        quantity: Math.max(0, safeNumber(p.quantity) + delta),
        stockHistory: [movement, ...(p.stockHistory || [])]
      };
    }));
    setStockModalVisible(false);
  }

  function openReceivePayment(bill) {
    setPaymentBill(bill);
    setReceiveAmount(String(billBalance(bill)));
  }

  function saveReceivedPayment() {
    if (!paymentBill) return;
    const amount = safeNumber(receiveAmount);
    const balance = billBalance(paymentBill);
    if (amount <= 0) { Alert.alert("Amount required", "कृपया प्राप्त राशि भरें।"); return; }
    if (amount > balance) { Alert.alert("Invalid amount", `बाकी राशि ${money(balance)} है।`); return; }
    const entry = { id: String(Date.now()), amount, date: new Date().toLocaleString("en-IN"), mode: "Cash/UPI" };
    setBills(old => old.map(b => b.id === paymentBill.id ? { ...b, paymentHistory: [entry, ...(b.paymentHistory || [])] } : b));
    setPaymentBill(null); setReceiveAmount("");
    Alert.alert("Payment saved", `${money(amount)} की payment दर्ज हो गई है।`);
  }

  function openBilling() {
    setBillingProductSearch("");
    setCustomerName("");
    setCustomerMobile("");
    setCart([]);
    setExtraDiscountPercent("0");
    setPaymentMode("Cash");
    setPaidAmount("");
    setBillingVisible(true);
  }

  function addToCart(product, variantIndex = null) {
    const variant = variantIndex !== null ? (product.variants || [])[variantIndex] : null;
    const available = variant ? safeNumber(variant.quantity) : stockOf(product);
    const cartKey = `${product.id}_${variantIndex === null ? "single" : variantIndex}`;
    const existing = cart.find(line => line.key === cartKey);
    const alreadyAdded = existing ? existing.quantity : 0;
    if (available <= alreadyAdded) {
      Alert.alert("Stock unavailable", "इस डिजाइन का पर्याप्त स्टॉक उपलब्ध नहीं है।");
      return;
    }
    setCart(old => {
      const found = old.find(line => line.key === cartKey);
      if (found) return old.map(line => line.key === cartKey ? { ...line, quantity: line.quantity + 1 } : line);
      return [...old, {
        key: cartKey, productId: product.id, variantIndex,
        name: product.name, code: product.code,
        variantLabel: variant ? `${variant.colour} / ${variant.size}` : "Single design",
        unitPrice: safeNumber(product.selling),
        mrp: safeNumber(product.mrp) || safeNumber(product.selling),
        quantity: 1
      }];
    });
  }

  function changeCartQty(key, nextQty) {
    const line = cart.find(x => x.key === key);
    if (!line) return;
    const qty = Math.floor(Number(nextQty));
    if (!qty || qty < 1) {
      setCart(old => old.filter(x => x.key !== key));
      return;
    }
    const product = products.find(p => p.id === line.productId);
    const variant = line.variantIndex !== null ? product?.variants?.[line.variantIndex] : null;
    const available = variant ? safeNumber(variant.quantity) : (product ? stockOf(product) : 0);
    if (qty > available) {
      Alert.alert("Not enough stock", `Available stock: ${available}`);
      return;
    }
    setCart(old => old.map(x => x.key === key ? { ...x, quantity: qty } : x));
  }

  const cartSubtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const cartMrpTotal = cart.reduce((sum, line) => sum + line.mrp * line.quantity, 0);
  const normalSavings = Math.max(0, cartMrpTotal - cartSubtotal);
  const extraPct = Math.min(100, safeNumber(extraDiscountPercent));
  const cartDiscount = Math.min(cartSubtotal, cartSubtotal * extraPct / 100);
  const billTotal = Math.max(0, cartSubtotal - cartDiscount);
  const cartSavings = normalSavings + cartDiscount;
  const billPaid = paidAmount.trim() === "" ? billTotal : Math.min(billTotal, safeNumber(paidAmount));
  const billDue = Math.max(0, billTotal - billPaid);

  function saveBill() {
    if (!cart.length) {
      Alert.alert("Empty bill", "पहले कम से कम एक प्रोडक्ट जोड़ें।");
      return;
    }
    if (!customerName.trim()) {
      Alert.alert("Customer name", "कृपया ग्राहक का नाम भरें।");
      return;
    }
    if (customerMobile.trim() && !/^[0-9]{10}$/.test(customerMobile.trim())) {
      Alert.alert("Mobile number", "कृपया 10 अंकों का मोबाइल नंबर भरें।");
      return;
    }
    const billItems = cart.map(line => ({ ...line }));
    for (const line of billItems) {
      const product = products.find(p => p.id === line.productId);
      if (!product) {
        Alert.alert("Product missing", `${line.name} अब स्टॉक में उपलब्ध नहीं है।`);
        return;
      }
      const variant = line.variantIndex !== null ? product.variants?.[line.variantIndex] : null;
      const available = variant ? safeNumber(variant.quantity) : stockOf(product);
      if (line.quantity > available) {
        Alert.alert("Stock changed", `${line.name} का उपलब्ध स्टॉक ${available} है।`);
        return;
      }
    }
    const billNo = `JSS-${String(Date.now()).slice(-7)}`;
    const bill = {
      id: String(Date.now()), billNo, customerName: customerName.trim(),
      customerMobile: customerMobile.trim(), items: billItems,
      subtotal: cartSubtotal, mrpTotal: cartMrpTotal, productSavings: normalSavings,
      extraDiscountPercent: extraPct, discount: cartDiscount,
      totalSavings: cartSavings, total: billTotal,
      paymentMode, paid: billPaid, due: billDue,
      date: new Date().toLocaleString("en-IN"), format: "thermal"
    };
    setProducts(old => old.map(product => {
      const lines = billItems.filter(line => line.productId === product.id);
      if (!lines.length) return product;
      let updated = { ...product };
      lines.forEach(line => {
        const movement = {
          id: `${bill.id}_${line.key}`, direction: "out",
          quantity: line.quantity, variantLabel: line.variantLabel,
          note: `Bill ${billNo}`, date: bill.date
        };
        if (line.variantIndex !== null) {
          updated.variants = updated.variants.map((v, i) =>
            i === line.variantIndex ? { ...v, quantity: Math.max(0, safeNumber(v.quantity) - line.quantity) } : v
          );
        } else {
          updated.quantity = Math.max(0, safeNumber(updated.quantity) - line.quantity);
        }
        updated.stockHistory = [movement, ...(updated.stockHistory || [])];
      });
      return updated;
    }));
    setBills(old => [bill, ...old]);
    setBillingVisible(false);
    setCart([]);
    setReceiptFormat("thermal");
    setReceiptBill(bill);
  }

  async function shareBillWhatsApp(bill) {
    const lines = [
      "JAI SHREE DESIGNER SUITS",
      "BILL / RECEIPT",
      `Bill No: ${bill.billNo}`,
      `Date: ${bill.date}`,
      `Customer: ${bill.customerName}`,
      ...(bill.customerMobile ? [`Mobile: ${bill.customerMobile}`] : []),
      "------------------------------",
      ...bill.items.map((item, i) => `${i + 1}. ${item.name} (${item.code}) - ${item.variantLabel} x ${item.quantity} | MRP ${money(item.mrp || item.unitPrice)} | Price ${money(item.unitPrice)} | Saving ${money(Math.max(0,(item.mrp || item.unitPrice)-item.unitPrice)*item.quantity)}`),
      "------------------------------",
      `MRP Total: ${money(bill.mrpTotal || bill.subtotal)}`,
      `Regular MRP Savings: ${money(bill.productSavings || 0)}`,
      `Subtotal after regular discount: ${money(bill.subtotal)}`,
      `Extra ${bill.extraDiscountPercent || 0}% discount: ${money(bill.discount)}`,
      `Total Customer Savings: ${money(bill.totalSavings || ((bill.productSavings || 0) + (bill.discount || 0)))}`,
      `TOTAL: ${money(bill.total)}`,
      `Payment: ${bill.paymentMode}`,
      `Paid: ${money(bill.paid)}`,
      `Balance Due: ${money(billBalance(bill))}`,
      "Thank you for shopping with us!"
    ];
    const message = encodeURIComponent(lines.join("\n"));
    const url = bill.customerMobile
      ? `https://wa.me/91${bill.customerMobile}?text=${message}`
      : `https://wa.me/?text=${message}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("WhatsApp unavailable", "WhatsApp खोल नहीं पाया। कृपया WhatsApp इंस्टॉल करें या नंबर जाँचें।");
    }
  }

  const selectedStockProduct = products.find(p => p.id === stockProductId);
  const historyProduct = products.find(p => p.id === historyProductId);

  const profit = safeNumber(form.selling) - safeNumber(form.purchase);
  const discountAmount = safeNumber(form.mrp) * safeNumber(form.discount) / 100;

  function ProductCard({ item }) {
    const qty = stockOf(item);
    return (
      <View style={styles.productCard}>
        {item.image
          ? <Image source={{ uri: item.image }} style={styles.productImage} />
          : <View style={[styles.productImage, styles.imagePlaceholder]}><Text style={{fontSize: 28}}>👗</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productMeta}>{item.code} · {item.category}</Text>
          <Text style={styles.price}>{money(item.selling)} <Text style={styles.mrp}>{item.mrp ? money(item.mrp) : ""}</Text></Text>
          <Text style={styles.productMeta}>Stock: {qty} pieces · {item.type === "variant" ? "Variants" : "Single design"}</Text>
          {!!item.supplier && <Text style={styles.productMeta}>Supplier: {item.supplier}</Text>}
          {!!item.purchaseDate && <Text style={styles.productMeta}>Purchased: {item.purchaseDate}</Text>}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEdit(item)} style={styles.smallButton}><Text style={styles.smallButtonText}>Edit</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => openStock(item, "in")} style={styles.smallButton}><Text style={styles.smallButtonText}>Stock In</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => openStock(item, "out")} style={styles.smallButton}><Text style={styles.smallButtonText}>Stock Out</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setHistoryProductId(item.id)} style={styles.smallButton}><Text style={styles.smallButtonText}>History</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => deleteProduct(item)} style={[styles.smallButton, {borderColor:"#8C5146"}]}><Text style={[styles.smallButtonText,{color:"#E5A69A"}]}>Delete</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={DARK} />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>JAI SHREE</Text>
          <Text style={styles.brandSub}>DESIGNER SUITS</Text>
          <Text style={styles.tagline}>BILLING  ·  INVENTORY</Text>
        </View>
        <View style={styles.crown}><Text style={{fontSize:25}}>♛</Text></View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.heading}>My Products</Text>
            <Text style={styles.subheading}>अपने प्रोडक्ट और स्टॉक मैनेज करें</Text>
          </View>
          <View style={{flexDirection:"row",gap:7}}>
            <TouchableOpacity style={styles.smallButton} onPress={()=>{setLedgerCustomer(null);setLedgerVisible(true);}}><Text style={styles.smallButtonText}>खाता</Text></TouchableOpacity>
            <TouchableOpacity style={styles.billingButton} onPress={openBilling}><Text style={styles.addButtonText}>＋ Billing</Text></TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={openAdd}><Text style={styles.addButtonText}>＋ Add</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statLabel}>Products</Text><Text style={styles.statValue}>{products.length}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>Total Pieces</Text><Text style={styles.statValue}>{totalPieces}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>Low Stock</Text><Text style={[styles.statValue,{color:"#E4B66D"}]}>{lowStock}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>Udhar</Text><Text style={[styles.statValue,{fontSize:16,color:"#9B493C"}]}>{money(totalOutstanding)}</Text></View>
        </View>

        <TextInput value={search} onChangeText={setSearch} placeholder="Search name, code or category..." placeholderTextColor="#8C7B6A" style={styles.search} />
        <View style={styles.billHistoryHeader}>
          <Text style={styles.sectionTitle}>Recent Bills ({bills.length})</Text>
          {bills[0] && <TouchableOpacity onPress={()=>{setReceiptBill(bills[0]);setReceiptFormat("thermal");}}><Text style={styles.saveText}>Latest Bill</Text></TouchableOpacity>}
        </View>
        {bills.slice(0,3).map(b=>(
          <TouchableOpacity key={b.id} style={styles.recentBill} onPress={()=>{setReceiptBill(b);setReceiptFormat("thermal");}}>
            <View style={{flex:1}}>
              <Text style={styles.productName}>{b.billNo} · {b.customerName}</Text>
              <Text style={styles.productMeta}>{b.date} · {b.paymentMode} · Due {money(billBalance(b))}</Text>
            </View>
            <Text style={styles.price}>{money(b.total)}</Text>
          </TouchableOpacity>
        ))}
        {loaded ? (
          <FlatList
            data={filtered} keyExtractor={item => item.id}
            renderItem={({item}) => <ProductCard item={item} />}
            contentContainerStyle={{paddingBottom:30}}
            ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyIcon}>🛍️</Text><Text style={styles.emptyTitle}>अभी कोई प्रोडक्ट नहीं है</Text><Text style={styles.emptyText}>अपना पहला सूट जोड़ने के लिए “Add” दबाएँ।</Text></View>}
          />
        ) : <Text style={styles.emptyText}>Loading products...</Text>}
      </View>

      <Modal visible={ledgerVisible} animationType="slide" onRequestClose={() => setLedgerVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={()=>ledgerCustomer ? setLedgerCustomer(null) : setLedgerVisible(false)}><Text style={styles.cancel}>{ledgerCustomer ? "Back" : "Close"}</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{ledgerCustomer ? "Customer Khata" : "Customer Ledger"}</Text>
            <Text style={styles.saveText}>{money(totalOutstanding)}</Text>
          </View>
          <ScrollView contentContainerStyle={{padding:16}}>
            {!ledgerCustomer ? (
              <>
                <Text style={styles.subheading}>ग्राहक के नाम पर कुल बिल और बाकी उधार</Text>
                {ledgerCustomers.length === 0 ? <Text style={styles.emptyText}>अभी कोई बिल रिकॉर्ड नहीं है।</Text> : ledgerCustomers.map(c=>(
                  <TouchableOpacity key={c.key} style={styles.recentBill} onPress={()=>setLedgerCustomer(c.key)}>
                    <View style={{flex:1}}><Text style={styles.productName}>{c.name}</Text><Text style={styles.productMeta}>{c.mobile || "Mobile नहीं दिया"} · {c.bills.length} bill(s)</Text><Text style={styles.productMeta}>Total bills: {money(c.total)}</Text></View>
                    <Text style={[styles.price,{color:c.due>0?"#9B493C":"#27613F"}]}>{money(c.due)}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (() => {
              const c = ledgerCustomers.find(x=>x.key===ledgerCustomer);
              if (!c) return <Text style={styles.emptyText}>Customer record not found.</Text>;
              return <>
                <Text style={styles.heading}>{c.name}</Text><Text style={styles.subheading}>{c.mobile || "Mobile नहीं दिया"}</Text>
                <View style={styles.billSummary}><Text style={styles.billSummaryText}>Total Bill: {money(c.total)}</Text><Text style={[styles.billTotalText,{color:c.due>0?"#9B493C":"#27613F"}]}>Total Due: {money(c.due)}</Text></View>
                {c.bills.map(b=>(<View key={b.id} style={styles.historyRow}>
                  <Text style={styles.productName}>{b.billNo}</Text><Text style={styles.productMeta}>{b.date} · {b.paymentMode}</Text>
                  <Text style={styles.billSummaryText}>Bill: {money(b.total)} · Paid: {money(safeNumber(b.paid)+(b.paymentHistory||[]).reduce((sum,x)=>sum+safeNumber(x.amount),0))}</Text>
                  <Text style={[styles.billSummaryText,{color:billBalance(b)>0?"#9B493C":"#27613F"}]}>बाकी: {money(billBalance(b))}</Text>
                  {(b.paymentHistory||[]).map(x=><Text key={x.id} style={styles.productMeta}>Payment received: {money(x.amount)} · {x.date}</Text>)}
                  {billBalance(b)>0 && <TouchableOpacity style={styles.saveFull} onPress={()=>openReceivePayment(b)}><Text style={styles.saveFullText}>Receive Payment</Text></TouchableOpacity>}
                </View>))}
              </>;
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!paymentBill} animationType="slide" transparent onRequestClose={()=>setPaymentBill(null)}>
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.45)",justifyContent:"center",padding:22}}>
          <View style={{backgroundColor:CREAM,borderRadius:16,padding:18}}>
            <Text style={styles.heading}>Receive Payment</Text>
            <Text style={styles.productMeta}>{paymentBill?.customerName} · {paymentBill?.billNo}</Text>
            <Text style={[styles.billSummaryText,{marginTop:12}]}>Remaining Due: {paymentBill ? money(billBalance(paymentBill)) : money(0)}</Text>
            <Field label="Received Amount (₹)" value={receiveAmount} onChangeText={setReceiveAmount} keyboardType="decimal-pad"/>
            <TouchableOpacity style={styles.saveFull} onPress={saveReceivedPayment}><Text style={styles.saveFullText}>Save Payment</Text></TouchableOpacity>
            <TouchableOpacity style={{padding:12,alignItems:"center"}} onPress={()=>setPaymentBill(null)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex:1}}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>{editingId ? "Edit Product" : "Add Product"}</Text>
              <TouchableOpacity onPress={saveProduct}><Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{padding:18,paddingBottom:50}} keyboardShouldPersistTaps="handled">
              <TouchableOpacity style={styles.photoBox} onPress={chooseImage}>
                {form.image ? <Image source={{uri:form.image}} style={styles.chosenImage}/> : <><Text style={{fontSize:30}}>📷</Text><Text style={styles.photoText}>फोटो चुनें / Choose Photo</Text></>}
              </TouchableOpacity>

              <Field label="Product Name *" value={form.name} onChangeText={v=>setField("name",v)} placeholder="जैसे Pista Green Suit" />
              <View style={styles.field}>
                <Text style={styles.label}>Product Code * (Automatic / Manual)</Text>
                <TextInput value={form.code} onChangeText={v=>setField("code",v.toUpperCase())} style={styles.input} autoCapitalize="characters" placeholder="JS001" placeholderTextColor="#8C7B6A"/>
                <Text style={styles.hint}>नया कोड अपने आप भरा जाता है। आप इसे बदल भी सकती हैं।</Text>
              </View>

              <Text style={styles.label}>Product Type</Text>
              <View style={styles.segmentRow}>
                <TouchableOpacity onPress={()=>setField("type","single")} style={[styles.segment,form.type==="single"&&styles.segmentActive]}><Text style={[styles.segmentText,form.type==="single"&&styles.segmentTextActive]}>Single Design</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>setField("type","variant")} style={[styles.segment,form.type==="variant"&&styles.segmentActive]}><Text style={[styles.segmentText,form.type==="variant"&&styles.segmentTextActive]}>Size / Colour</Text></TouchableOpacity>
              </View>

              <Field label="Category" value={form.category} onChangeText={v=>setField("category",v)} placeholder="Designer Suit / Saree / Sharara" />
              <Field label="Supplier Name (माल कहाँ से खरीदा)" value={form.supplier} onChangeText={v=>setField("supplier",v)} placeholder="Supplier / Shop name" />
              <Field label="Purchase Date (DD/MM/YYYY)" value={form.purchaseDate} onChangeText={v=>setField("purchaseDate",v)} placeholder="26/11/2026" />
              <View style={styles.twoCols}>
                <View style={{flex:1}}><Field label="Purchase Price *" value={form.purchase} onChangeText={v=>setField("purchase",v)} keyboardType="decimal-pad" placeholder="1200"/></View>
                <View style={{flex:1}}><Field label="Selling Price *" value={form.selling} onChangeText={v=>setField("selling",v)} keyboardType="decimal-pad" placeholder="2000"/></View>
              </View>
              <View style={styles.twoCols}>
                <View style={{flex:1}}><Field label="MRP" value={form.mrp} onChangeText={v=>setField("mrp",v)} keyboardType="decimal-pad" placeholder="2500"/></View>
                <View style={{flex:1}}><Field label="Discount %" value={form.discount} onChangeText={v=>setField("discount",v)} keyboardType="decimal-pad" placeholder="0"/></View>
              </View>
              <View style={styles.profitBox}>
                <Text style={styles.profitLabel}>Estimated profit per piece</Text>
                <Text style={styles.profitValue}>{money(profit)}</Text>
                <Text style={styles.hint}>Selling Price − Purchase Price. Other expenses are not included.</Text>
              </View>
              {form.type === "single" ? (
                <View style={styles.twoCols}>
                  <View style={{flex:1}}><Field label="Quantity" value={form.quantity} onChangeText={v=>setField("quantity",v)} keyboardType="number-pad" placeholder="5"/></View>
                  <View style={{flex:1}}><Field label="Low Stock Alert" value={form.minStock} onChangeText={v=>setField("minStock",v)} keyboardType="number-pad" placeholder="2"/></View>
                </View>
              ) : (
                <>
                  <Text style={[styles.label,{marginTop:8}]}>Variants (Colour + Size + Quantity)</Text>
                  {form.variants.map((v,i)=>(
                    <View key={i} style={styles.variantBox}>
                      <View style={styles.twoCols}>
                        <View style={{flex:1}}><Field label="Colour" value={v.colour} onChangeText={x=>updateVariant(i,"colour",x)} placeholder="Pink"/></View>
                        <View style={{flex:1}}><Field label="Size" value={v.size} onChangeText={x=>updateVariant(i,"size",x)} placeholder="M / L / XL"/></View>
                      </View>
                      <View style={styles.twoCols}>
                        <View style={{flex:1}}><Field label="Quantity" value={String(v.quantity)} onChangeText={x=>updateVariant(i,"quantity",x)} keyboardType="number-pad" placeholder="2"/></View>
                        <View style={{flex:1,justifyContent:"flex-end"}}><TouchableOpacity onPress={()=>removeVariant(i)} style={styles.removeVariant}><Text style={{color:"#F0B1A4",fontWeight:"700"}}>Remove variant</Text></TouchableOpacity></View>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addVariant} onPress={addVariant}><Text style={styles.addVariantText}>＋ Add Colour / Size</Text></TouchableOpacity>
                  <Field label="Low Stock Alert (total pieces)" value={form.minStock} onChangeText={v=>setField("minStock",v)} keyboardType="number-pad" placeholder="2"/>
                </>
              )}
              <TouchableOpacity style={styles.saveFull} onPress={saveProduct}><Text style={styles.saveFullText}>Save Product</Text></TouchableOpacity>
              <Text style={styles.footerNote}>पहले चरण में डेटा इसी फोन में सेव होगा। Cloud backup अगले चरण में जोड़ा जाएगा।</Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={billingVisible} animationType="slide" onRequestClose={() => setBillingVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setBillingVisible(false)}><Text style={styles.cancel}>Close</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>New Bill</Text>
            <TouchableOpacity onPress={saveBill}><Text style={styles.saveText}>Save Bill</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{padding:16,paddingBottom:45}} keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>Customer Details</Text>
            <Field label="Customer Name *" value={customerName} onChangeText={setCustomerName} placeholder="Customer name"/>
            <Field label="Mobile Number (10 digits)" value={customerMobile} onChangeText={setCustomerMobile} placeholder="98XXXXXXXX" keyboardType="number-pad"/>
            <Text style={[styles.heading,{fontSize:18,marginTop:8}]}>Add Products</Text>
            <TextInput
              value={billingProductSearch}
              onChangeText={setBillingProductSearch}
              placeholder="Product code या नाम लिखें..."
              placeholderTextColor="#8C7B6A"
              autoCapitalize="characters"
              returnKeyType="search"
              style={styles.search}
            />
            {products.filter(product => `${product.code || ""} ${product.name || ""} ${product.category || ""}`.toLowerCase().includes(billingProductSearch.trim().toLowerCase())).map(product => (
              <View key={product.id} style={styles.billProductRow}>
                <View style={{flex:1}}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productMeta}>{product.code} · {money(product.selling)} · Stock {stockOf(product)}</Text>
                  {product.type === "variant" ? (product.variants || []).map((v,i)=>(
                    <TouchableOpacity key={`${product.id}_${i}`} style={styles.variantAddButton} onPress={()=>addToCart(product,i)}>
                      <Text style={styles.smallButtonText}>＋ {v.colour} / {v.size} · {v.quantity} pcs</Text>
                    </TouchableOpacity>
                  )) : (
                    <TouchableOpacity style={styles.variantAddButton} onPress={()=>addToCart(product,null)}>
                      <Text style={styles.smallButtonText}>＋ Add to bill</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            {billingProductSearch.trim() && products.filter(product => `${product.code || ""} ${product.name || ""} ${product.category || ""}`.toLowerCase().includes(billingProductSearch.trim().toLowerCase())).length === 0 && (
              <Text style={styles.emptyText}>इस Code या नाम से कोई Product नहीं मिला।</Text>
            )}
            <Text style={[styles.heading,{fontSize:18,marginTop:14}]}>Bill Items ({cart.length})</Text>
            {cart.length === 0 ? <Text style={styles.emptyText}>अभी बिल में कोई प्रोडक्ट नहीं है।</Text> : cart.map(line=>(
              <View key={line.key} style={styles.cartRow}>
                <View style={{flex:1}}>
                  <Text style={styles.productName}>{line.name}</Text>
                  <Text style={styles.productMeta}>{line.variantLabel}</Text>
                  <Text style={styles.productMeta}>MRP: {money(line.mrp)}  ·  Selling: {money(line.unitPrice)}</Text>
                  {line.mrp > line.unitPrice && <Text style={{fontSize:11,color:"#27613F",fontWeight:"800"}}>You save {money((line.mrp-line.unitPrice)*line.quantity)}</Text>}
                  <Text style={styles.price}>{money(line.unitPrice * line.quantity)}</Text>
                </View>
                <View style={{width:92,alignItems:"center"}}>
                  <Text style={styles.label}>Qty</Text>
                  <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
                    <TouchableOpacity onPress={()=>changeCartQty(line.key,line.quantity-1)} style={styles.qtyButton}><Text style={styles.qtyButtonText}>−</Text></TouchableOpacity>
                    <Text style={styles.productName}>{line.quantity}</Text>
                    <TouchableOpacity onPress={()=>changeCartQty(line.key,line.quantity+1)} style={styles.qtyButton}><Text style={styles.qtyButtonText}>＋</Text></TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={()=>setCart(old=>old.filter(x=>x.key!==line.key))}><Text style={{color:"#9B493C",fontWeight:"800",fontSize:11,marginTop:7}}>Remove</Text></TouchableOpacity>
                </View>
              </View>
            ))}
            <Field label="Extra Discount for this customer (%)" value={extraDiscountPercent} onChangeText={setExtraDiscountPercent} placeholder="0" keyboardType="decimal-pad"/>
            <Text style={styles.hint}>पहले Product का regular discount (जैसे 20%) Selling Price में लागू होगा। फिर यहाँ दिया extra discount बची हुई कीमत पर लगेगा।</Text>
            <View style={styles.billSummary}>
              <Text style={styles.billSummaryText}>MRP Total: {money(cartMrpTotal)}</Text>
              <Text style={[styles.billSummaryText,{color:"#27613F"}]}>Regular MRP Savings: {money(normalSavings)}</Text>
              <Text style={styles.billSummaryText}>Price after regular discount: {money(cartSubtotal)}</Text>
              <Text style={styles.billSummaryText}>Extra {extraPct}% discount: −{money(cartDiscount)}</Text>
              <Text style={[styles.billSummaryText,{color:"#27613F"}]}>Total Customer Savings: {money(cartSavings)}</Text>
              <Text style={styles.billTotalText}>TOTAL: {money(billTotal)}</Text>
            </View>
            <Text style={[styles.heading,{fontSize:18,marginTop:14}]}>Payment</Text>
            <View style={styles.segmentRow}>
              {["Cash","UPI"].map(mode=>(
                <TouchableOpacity key={mode} onPress={()=>setPaymentMode(mode)} style={[styles.segment,paymentMode===mode&&styles.segmentActive]}>
                  <Text style={[styles.segmentText,paymentMode===mode&&styles.segmentTextActive]}>{mode}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="Amount Received (₹) — blank means full payment" value={paidAmount} onChangeText={setPaidAmount} placeholder={String(billTotal)} keyboardType="decimal-pad"/>
            <View style={styles.billSummary}>
              <Text style={styles.billSummaryText}>Paid: {money(billPaid)}</Text>
              <Text style={[styles.billTotalText,{color:billDue>0?"#9B493C":"#27613F"}]}>Due / Udhar: {money(billDue)}</Text>
            </View>
            <TouchableOpacity style={styles.saveFull} onPress={saveBill}><Text style={styles.saveFullText}>Save Bill & Update Stock</Text></TouchableOpacity>
            <Text style={styles.footerNote}>Bill save होते ही चुने गए products का stock अपने आप कम होगा। Bill और payment details इस फोन में सेव होंगे।</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!receiptBill} animationType="slide" onRequestClose={() => setReceiptBill(null)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReceiptBill(null)}><Text style={styles.cancel}>Close</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Bill Receipt</Text>
            <TouchableOpacity onPress={() => shareBillWhatsApp(receiptBill)}><Text style={styles.saveText}>WhatsApp</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{padding:16}}>
            <View style={styles.segmentRow}>
              <TouchableOpacity onPress={()=>setReceiptFormat("thermal")} style={[styles.segment,receiptFormat==="thermal"&&styles.segmentActive]}><Text style={[styles.segmentText,receiptFormat==="thermal"&&styles.segmentTextActive]}>Thermal</Text></TouchableOpacity>
              <TouchableOpacity onPress={()=>setReceiptFormat("a4")} style={[styles.segment,receiptFormat==="a4"&&styles.segmentActive]}><Text style={[styles.segmentText,receiptFormat==="a4"&&styles.segmentTextActive]}>A4</Text></TouchableOpacity>
            </View>
            {receiptBill && (
              <View style={[styles.receiptPaper, receiptFormat==="thermal" ? {maxWidth:360,alignSelf:"center",width:"100%"} : {width:"100%"}]}>
                <Text style={styles.receiptBrand}>JAI SHREE DESIGNER SUITS</Text>
                <Text style={styles.receiptSub}>BILL / RECEIPT</Text>
                <Text style={styles.productMeta}>Bill: {receiptBill.billNo}</Text>
                <Text style={styles.productMeta}>Date: {receiptBill.date}</Text>
                <Text style={styles.productMeta}>Customer: {receiptBill.customerName}</Text>
                {!!receiptBill.customerMobile && <Text style={styles.productMeta}>Mobile: {receiptBill.customerMobile}</Text>}
                <View style={styles.receiptDivider}/>
                {receiptBill.items.map((item,i)=>(
                  <View key={`${receiptBill.id}_${i}`} style={styles.receiptLine}>
                    <View style={{flex:1}}>
                      <Text style={styles.productName}>{item.name}</Text>
                      <Text style={styles.productMeta}>{item.code} · {item.variantLabel} · Qty {item.quantity}</Text>
                      <Text style={styles.productMeta}>MRP {money(item.mrp || item.unitPrice)} · Selling {money(item.unitPrice)}</Text>
                      {(item.mrp || item.unitPrice) > item.unitPrice && <Text style={{fontSize:11,color:"#27613F",fontWeight:"800"}}>Saving {money(((item.mrp || item.unitPrice)-item.unitPrice)*item.quantity)}</Text>}
                    </View>
                    <Text style={styles.productName}>{money(item.unitPrice*item.quantity)}</Text>
                  </View>
                ))}
                <View style={styles.receiptDivider}/>
                <Text style={styles.billSummaryText}>MRP Total: {money(receiptBill.mrpTotal || receiptBill.subtotal)}</Text>
                <Text style={[styles.billSummaryText,{color:"#27613F"}]}>Regular MRP Savings: {money(receiptBill.productSavings || 0)}</Text>
                <Text style={styles.billSummaryText}>Price after regular discount: {money(receiptBill.subtotal)}</Text>
                <Text style={styles.billSummaryText}>Extra {receiptBill.extraDiscountPercent || 0}% discount: −{money(receiptBill.discount)}</Text>
                <Text style={[styles.billSummaryText,{color:"#27613F"}]}>Total Customer Savings: {money(receiptBill.totalSavings || ((receiptBill.productSavings || 0) + (receiptBill.discount || 0)))}</Text>
                <Text style={styles.billTotalText}>TOTAL: {money(receiptBill.total)}</Text>
                <Text style={styles.billSummaryText}>Payment: {receiptBill.paymentMode}</Text>
                <Text style={styles.billSummaryText}>Paid: {money(safeNumber(receiptBill.paid) + (receiptBill.paymentHistory || []).reduce((sum, item) => sum + safeNumber(item.amount), 0))}</Text>
                <Text style={[styles.billTotalText,{color:receiptBill.due>0?"#9B493C":"#27613F"}]}>Due: {money(billBalance(receiptBill))}</Text>
                <Text style={[styles.receiptSub,{marginTop:18}]}>Thank you for shopping with us!</Text>
              </View>
            )}
            <TouchableOpacity style={styles.saveFull} onPress={()=>shareBillWhatsApp(receiptBill)}><Text style={styles.saveFullText}>Share Bill on WhatsApp</Text></TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={stockModalVisible} animationType="slide" onRequestClose={() => setStockModalVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setStockModalVisible(false)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{stockDirection === "in" ? "Stock In" : "Stock Out"}</Text>
            <TouchableOpacity onPress={applyStockMovement}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{padding:18}}>
            <Text style={styles.heading}>{selectedStockProduct?.name || "Product"}</Text>
            <Text style={styles.subheading}>Code: {selectedStockProduct?.code}</Text>
            {selectedStockProduct?.type === "variant" ? (
              <>
                <Text style={[styles.label,{marginTop:18}]}>Colour / Size चुनें</Text>
                {(selectedStockProduct.variants || []).map((v,i)=>(
                  <TouchableOpacity key={i} onPress={()=>setStockVariantIndex(i)} style={[styles.variantChoice, stockVariantIndex===i && styles.variantChoiceActive]}>
                    <Text style={{color:stockVariantIndex===i?"#F0D29D":DARK,fontWeight:"800"}}>{v.colour} / {v.size} · Available: {v.quantity}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <Text style={[styles.productMeta,{marginTop:18}]}>Available stock: {selectedStockProduct?.quantity || 0} pieces</Text>
            )}
            <View style={{marginTop:18}}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput value={stockQty} onChangeText={setStockQty} keyboardType="number-pad" style={styles.input} placeholder="Enter pieces"/>
            </View>
            <View style={{marginTop:14}}>
              <Text style={styles.label}>Note (optional)</Text>
              <TextInput value={stockNote} onChangeText={setStockNote} style={styles.input} placeholder={stockDirection==="in"?"New purchase / supplier note":"Sale / damage / adjustment"} />
            </View>
            <TouchableOpacity style={styles.saveFull} onPress={applyStockMovement}><Text style={styles.saveFullText}>{stockDirection==="in"?"Add Stock":"Reduce Stock"}</Text></TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!historyProductId} animationType="slide" onRequestClose={() => setHistoryProductId(null)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setHistoryProductId(null)}><Text style={styles.cancel}>Close</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Stock History</Text>
            <View style={{width:35}}/>
          </View>
          <ScrollView contentContainerStyle={{padding:18}}>
            <Text style={styles.heading}>{historyProduct?.name || "Product"}</Text>
            {(historyProduct?.stockHistory || []).length === 0
              ? <Text style={styles.emptyText}>अभी कोई Stock In / Out रिकॉर्ड नहीं है।</Text>
              : (historyProduct.stockHistory || []).map(m=>(
                <View key={m.id} style={styles.historyRow}>
                  <Text style={{fontWeight:"900",color:m.direction==="in"?"#27613F":"#9B493C"}}>{m.direction==="in"?"STOCK IN":"STOCK OUT"} · {m.quantity} pcs</Text>
                  <Text style={styles.productMeta}>{m.variantLabel} · {m.date}</Text>
                  {!!m.note && <Text style={styles.productMeta}>Note: {m.note}</Text>}
                </View>
              ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:DARK},
  header:{backgroundColor:DARK,paddingHorizontal:20,paddingTop:12,paddingBottom:18,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  brand:{color:"#E9C98B",fontSize:24,fontWeight:"900",letterSpacing:3},
  brandSub:{color:"#FFF8EF",fontSize:16,fontWeight:"800",letterSpacing:2},
  tagline:{color:"#C8AD8A",fontSize:9,letterSpacing:2,marginTop:5},
  crown:{width:52,height:52,borderRadius:16,backgroundColor:GOLD,alignItems:"center",justifyContent:"center"},
  content:{flex:1,backgroundColor:CREAM,borderTopLeftRadius:24,borderTopRightRadius:24,padding:16},
  titleRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  heading:{fontSize:23,fontWeight:"800",color:DARK},
  subheading:{fontSize:12,color:"#806D5A",marginTop:3},
  addButton:{backgroundColor:DARK,paddingVertical:11,paddingHorizontal:16,borderRadius:12},
  addButtonText:{color:"#F0D29D",fontWeight:"800"},
  statsRow:{flexDirection:"row",gap:8,marginBottom:14},
  stat:{flex:1,backgroundColor:"#EADCC9",borderRadius:13,padding:12},
  statLabel:{fontSize:10,color:"#806D5A"},
  statValue:{fontSize:22,fontWeight:"900",color:DARK,marginTop:4},
  search:{backgroundColor:"#FFFDF9",borderWidth:1,borderColor:"#E2D4C2",borderRadius:12,paddingHorizontal:14,paddingVertical:12,color:DARK,marginBottom:12},
  productCard:{backgroundColor:"#FFFCF7",borderRadius:15,padding:11,marginBottom:10,flexDirection:"row",gap:11,borderWidth:1,borderColor:"#E9DDCE",alignItems:"center"},
  productImage:{width:68,height:84,borderRadius:10,backgroundColor:"#E8DCCB"},
  imagePlaceholder:{alignItems:"center",justifyContent:"center"},
  productName:{fontSize:14,fontWeight:"800",color:DARK},
  productMeta:{fontSize:10,color:"#897765",marginTop:4},
  price:{fontSize:15,fontWeight:"900",color:"#9B6C2F",marginTop:5},
  mrp:{fontSize:10,color:"#A99A88",textDecorationLine:"line-through",fontWeight:"400"},
  cardActions:{gap:6},
  billingButton:{backgroundColor:"#8A612E",paddingVertical:11,paddingHorizontal:13,borderRadius:12},
  billProductRow:{backgroundColor:"#FFFCF7",borderWidth:1,borderColor:"#E9DDCE",borderRadius:12,padding:12,marginTop:8},
  variantAddButton:{borderWidth:1,borderColor:GOLD,borderRadius:8,padding:8,marginTop:7,alignSelf:"flex-start"},
  cartRow:{flexDirection:"row",gap:12,backgroundColor:"#FFFCF7",borderWidth:1,borderColor:"#E9DDCE",borderRadius:12,padding:12,marginTop:8,alignItems:"center"},
  qtyButton:{width:28,height:28,borderRadius:8,backgroundColor:DARK,alignItems:"center",justifyContent:"center"},
  qtyButtonText:{color:"#F0D29D",fontWeight:"900",fontSize:17},
  billSummary:{backgroundColor:"#EADCC9",borderRadius:12,padding:13,marginTop:8},
  billSummaryText:{fontSize:13,color:"#5A4030",marginVertical:3,fontWeight:"700"},
  billTotalText:{fontSize:19,color:DARK,fontWeight:"900",marginTop:6},
  receiptPaper:{backgroundColor:"#FFFFFF",padding:18,borderRadius:8,borderWidth:1,borderColor:"#E2D4C2",alignSelf:"center"},
  receiptBrand:{fontSize:18,fontWeight:"900",color:"#241711",textAlign:"center",letterSpacing:1},
  receiptSub:{fontSize:12,fontWeight:"800",color:"#806D5A",textAlign:"center",marginBottom:10},
  receiptDivider:{height:1,backgroundColor:"#CFC2B2",marginVertical:10},
  receiptLine:{flexDirection:"row",alignItems:"center",gap:8,marginVertical:6},
  billHistoryHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:6},
  sectionTitle:{fontSize:15,fontWeight:"900",color:DARK},
  recentBill:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFFCF7",borderRadius:10,padding:10,marginBottom:7,borderWidth:1,borderColor:"#E9DDCE"},
  variantChoice:{padding:13,borderRadius:10,borderWidth:1,borderColor:"#C9B69E",marginBottom:8,backgroundColor:"#FFFCF7"},
  variantChoiceActive:{backgroundColor:DARK,borderColor:DARK},
  historyRow:{backgroundColor:"#FFFCF7",borderRadius:12,padding:13,marginTop:10,borderWidth:1,borderColor:"#E9DDCE"},
  smallButton:{borderWidth:1,borderColor:GOLD,borderRadius:8,paddingHorizontal:9,paddingVertical:6,alignItems:"center"},
  smallButtonText:{fontSize:10,color:"#8D642E",fontWeight:"800"},
  empty:{alignItems:"center",paddingTop:55},
  emptyIcon:{fontSize:42},
  emptyTitle:{fontSize:16,fontWeight:"800",color:DARK,marginTop:10},
  emptyText:{fontSize:12,color:"#8C7B6A",marginTop:5,textAlign:"center"},
  modalSafe:{flex:1,backgroundColor:CREAM},
  modalHeader:{backgroundColor:DARK,paddingHorizontal:17,paddingVertical:16,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  cancel:{color:"#E9C98B",fontWeight:"700"},
  modalTitle:{color:"#FFF8EF",fontWeight:"900",fontSize:17},
  saveText:{color:"#E9C98B",fontWeight:"900"},
  photoBox:{height:145,borderRadius:15,borderWidth:1.5,borderColor:GOLD,borderStyle:"dashed",alignItems:"center",justifyContent:"center",backgroundColor:"#F0E5D6",marginBottom:16,overflow:"hidden"},
  photoText:{color:"#765A3C",fontWeight:"700",marginTop:7},
  chosenImage:{width:"100%",height:"100%",resizeMode:"contain"},
  field:{marginBottom:12,flex:1},
  label:{fontSize:12,fontWeight:"800",color:"#5A4030",marginBottom:6},
  input:{backgroundColor:"#FFFCF7",borderWidth:1,borderColor:"#DFD0BE",borderRadius:10,paddingHorizontal:12,paddingVertical:11,color:DARK,fontSize:14},
  hint:{fontSize:10,color:"#927F6B",marginTop:5},
  segmentRow:{flexDirection:"row",gap:8,marginBottom:14},
  segment:{flex:1,borderWidth:1,borderColor:"#C9B69E",borderRadius:10,padding:11,alignItems:"center"},
  segmentActive:{backgroundColor:DARK,borderColor:DARK},
  segmentText:{color:"#6F5B48",fontSize:12,fontWeight:"700"},
  segmentTextActive:{color:"#F0D29D"},
  twoCols:{flexDirection:"row",gap:10},
  profitBox:{backgroundColor:"#EADCC9",borderRadius:12,padding:13,marginBottom:14},
  profitLabel:{color:"#70543A",fontSize:11,fontWeight:"700"},
  profitValue:{color:"#27613F",fontSize:23,fontWeight:"900",marginTop:3},
  variantBox:{backgroundColor:"#EFE3D4",borderRadius:12,padding:10,marginBottom:9},
  removeVariant:{backgroundColor:"#59352D",padding:12,borderRadius:9,alignItems:"center"},
  addVariant:{borderWidth:1,borderColor:GOLD,borderRadius:10,padding:12,alignItems:"center",marginBottom:12},
  addVariantText:{color:"#8A612E",fontWeight:"900"},
  saveFull:{backgroundColor:DARK,borderRadius:12,padding:15,alignItems:"center",marginTop:8},
  saveFullText:{color:"#F0D29D",fontSize:15,fontWeight:"900"},
  footerNote:{fontSize:10,color:"#8C7B6A",textAlign:"center",marginTop:12}
});
