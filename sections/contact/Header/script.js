// Vendor
import gsap from "gsap";

// Components
import Section from "@/components/Section";
import Heading from "@/components/Heading";
import Body from "@/components/Body";
import WindowResizeObserver from "@/utils/WindowResizeObserver";

export default {
  mixins: [Section], // <--- FIXED inheritance

  components: {
    Heading,
    Body
  },

  data() {
    return {
      formData: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        message: "",
      },
      submissionSuccess: false,
      errorMessage: "",
      isLoading: false
    };
  },

  mounted() {
    this.setupEventListeners();
    this.resize();
  },

  beforeDestroy() {
    this.removeEventListeners();
  },

  methods: {

    transitionIn() {
      const tl = gsap.timeline();

      tl.set([this.$refs.sectionContent], { alpha: 1 }, 0);
      tl.fromTo(this.$refs.cForm, 1, { alpha: 0 }, { alpha: 1, ease: "sine.inOut" }, 0.7);

      tl.add(this.$refs.heading.show(), 0);
      tl.fromTo(this.$refs.addressTitle1, 1, { alpha: 0 }, { alpha: 1 }, 0.5);
      tl.call(() => this.$refs.body1.showBlock(0), null, 0.55);

      tl.fromTo([this.$refs.email, this.$refs.phone], 1, { alpha: 0 }, { alpha: 1 }, 0.8);
      tl.fromTo(this.$refs.email, 2, { y: "70%" }, { y: "0%" }, 0.8);
      tl.fromTo(this.$refs.phone, 2, { y: "140%" }, { y: "0%" }, 0.8);

      tl.to(this.$refs.background, 1.2, { alpha: 1 }, 0.1);
      return tl;
    },

    setupEventListeners() {
      WindowResizeObserver.addEventListener("resize", this.resizeHandler);
    },

    removeEventListeners() {
      WindowResizeObserver.removeEventListener("resize", this.resizeHandler);
    },

    resize() {
      this.$el.style.height = `${WindowResizeObserver.viewportHeight}px`;
    },

    resizeHandler() {
      this.resize();
    },

    emailClickHandler() {
      if (this.$ga) {
        this.$ga.event({
          eventCategory: "click",
          eventAction: "click on email",
        });
      }
    },

    phoneClickHandler() {
      if (this.$ga) {
        this.$ga.event({
          eventCategory: "click",
          eventAction: "click on phone number",
        });
      }
    },

    async handleSubmit() {
      if (this.isLoading) return;
      
      this.errorMessage = "";
      this.submissionSuccess = false;
      this.isLoading = true;

      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.formData),
        });

        const data = await res.json();

        if (data.success) {
          this.submissionSuccess = true;

          this.formData = {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            message: "",
          };
        } else {
          this.errorMessage = "Email failed: " + data.error;
        }
      } catch (err) {
        this.errorMessage = "Network error. Please try again.";
      } finally {
        this.isLoading = false;
      }
    }
  }
};
