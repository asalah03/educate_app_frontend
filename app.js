// ===================================
// Educate App Frontend (Vue 3)
// ===================================

const app = Vue.createApp({
  data() {
    return {
      // Backend API base
      apiBase: "https://educate-app-backend.onrender.com/api",

      // Which page is shown 
      view: "lessons",

      // Search text (search as you type)
      searchQuery: "",

      // Sorting options
      // attribute: "subject", "location", "price", "spaces"
      sortAttribute: "subject",
      sortDir: "asc",

      // List of lessons loaded from backend
      // Each lesson: { subject, location, price, spaces, image }
      lessons: [],

      // Cart holds 1 entry per seat added
      // Each item: { subject, location, price }
      cart: [],

      // Checkout form 
      customer: {
        name: "",
        phone: ""
      },

      // Confirmation message after checkout
      orderMessage: ""
    };
  },

  computed: {
    // =====================================
    // SEARCH: filter lessons by searchQuery
    // =====================================
    searchedLessons() {
      const term = this.searchQuery.toLowerCase();
      const filtered = [];

      for (const lesson of this.lessons) {
        // If there is no search term, keep all lessons
        if (!term) {
          filtered.push(lesson);
          continue;
        }

        const subjectText  = String(lesson.subject  || "").toLowerCase();
        const locationText = String(lesson.location || "").toLowerCase();
        const priceText    = String(lesson.price    || "").toLowerCase();
        const spacesText   = String(lesson.spaces   || "").toLowerCase();

        if (
          subjectText.includes(term)  ||
          locationText.includes(term) ||
          priceText.includes(term)    ||
          spacesText.includes(term)
        ) {
          filtered.push(lesson);
        }
      }

      return filtered;
    },

    // =====================================
    // SORT: sort the searched lessons
    // =====================================
    sortedLessons() {
      // i work on a copy so i don't mutate searchedLessons directly
      const list = [...this.searchedLessons];

      list.sort((a, b) => {
        const aVal = this.getSortValue(a);
        const bVal = this.getSortValue(b);

        if (aVal > bVal) return 1;
        if (aVal < bVal) return -1;
        return 0;
      });

      // If user chooses descending, the order list gets reversed 
      if (this.sortDir === "desc") {
        list.reverse();
      }

      return list;
    },

    // =====================================
    // FINAL LIST: The final lessons displayed on the page
    // =====================================
    displayedLessons() {
      // For the template we only need the final sorted + searched list
      return this.sortedLessons;
    },

    // Total number of items in the cart
    cartCount() {
      return this.cart.length;
    },

    // Total price of cart
    cartTotal() {
      return this.cart.reduce((sum, item) => {
        return sum + (item.price || 0);
      }, 0);
    },

    // Checkout validation: name letters only, phone numbers only + cart not empty
    isCheckoutValid() {
      const nameOK  = /^[A-Za-z ]+$/.test(this.customer.name);
      const phoneOK = /^[0-9]+$/.test(this.customer.phone);
      return nameOK && phoneOK && this.cart.length > 0;
    }
  },

  methods: {
    // ==================
    // VIEW / NAVIGATION
    // ==================
    go(page) {
      this.view = page;
    },

    // ================
    // HELPER FOR SORT
    // ================
    getSortValue(lesson) {
      if (this.sortAttribute === "subject") {
        return String(lesson.subject || "").toLowerCase();
      }
      if (this.sortAttribute === "location") {
        return String(lesson.location || "").toLowerCase();
      }
      if (this.sortAttribute === "price") {
        return lesson.price || 0;
      }
      if (this.sortAttribute === "spaces") {
        return lesson.spaces || 0;
      }
      return 0;
    },

    // ===========
    // IMAGE URL 
    // ===========
    backendOrigin() {
      try {
        return new URL(this.apiBase).origin;
      } catch {
        return "";
      }
    },

    imageUrl(src) {
      if (!src) return "";
      // If the image path starts with "images/", serve it from the backend
      if (src.startsWith("images/")) {
        return this.backendOrigin() + "/" + src;
      }
      // Otherwise assume it's already a full URL
      return src;
    },

    // ============================
    // LOAD LESSONS (GET)
    // ============================
    async loadLessons() {
      try {
        const res = await fetch(this.apiBase + "/lessons");
        if (!res.ok) throw new Error("Failed to fetch lessons");
        const data = await res.json();
        this.lessons = data;
      } catch (err) {
        console.error("Could not load lessons:", err);
        alert("Could not load lessons.");
      }
    },

    // ============================
    // CART: ADD
    // ============================
    addToCart(lesson) {
      if (!lesson || lesson.spaces <= 0) return;

      // Decrease spaces in lesson
      lesson.spaces -= 1;

      // Add one seat to cart
      this.cart.push({
        subject: lesson.subject,
        location: lesson.location,
        price: lesson.price
      });
    },

    // ============================
    // CART: REMOVE
    // ============================
    // Remove one specific item from the cart by index
    // and add that space back to the lesson list
    removeOne(index, item) {
      if (index < 0 || index >= this.cart.length) return;

      // 1. Remove that item from the cart array
      this.cart.splice(index, 1);

      // 2. Find the matching lesson and give a space back
      const lesson = this.lessons.find(
        (l) =>
          l.subject === item.subject &&
          l.location === item.location
      );

      if (lesson) {
        lesson.spaces += 1;
      }
    },

    // ============================
    // CHECKOUT: POST + PUT
    // ============================
    async checkout() {
      // Only allow if form + cart are valid
      if (!this.isCheckoutValid) return;

      const order = {
        name: this.customer.name,
        phone: this.customer.phone,
        items: this.cart,      // raw cart: one object per seat
        total: this.cartTotal  // total price
      };

      try {
        // 1. Send order to backend (POST)
        const res = await fetch(this.apiBase + "/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order)
        });

        if (!res.ok) throw new Error("Order failed");

        // 2. Update spaces in DB for each item in the cart (PUT)
        for (const item of this.cart) {
          const lesson = this.lessons.find(
            (l) =>
              l.subject === item.subject &&
              l.location === item.location
          );
          if (!lesson) continue;

          await fetch(this.apiBase + "/lessons", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subject: item.subject,
              location: item.location,
              spaces: lesson.spaces     
            })
          });
        }

        // 3. Clear cart and form, show message
        this.orderMessage = "Order submitted!";
        this.cart = [];
        this.customer = { name: "", phone: "" };

        // Reload lessons from DB (in case spaces changed on server)
        await this.loadLessons();
      } catch (err) {
        console.error("Error submitting order:", err);
        alert("There was a problem submitting your order.");
      }
    }
  },

  mounted() {
    this.loadLessons();
  }
});

app.mount("#app");
