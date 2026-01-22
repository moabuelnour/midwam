import ButtonUnderlined from '@/components/ButtonUnderlined'
export default {
    name: "ContactForm",
    components: {
      ButtonUnderlined
    },
    data() {
      return {
        formData: {
          name: "",
          email: "",
          message: "",
        },
        submissionSuccess: false,
        errorMessage: "",
        isLoading: false,
      };
    },
    methods: {
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
              name: "",
              email: "",
              message: ""
            };
          } else {
            this.errorMessage = "Email failed: " + data.error;
          }
        } catch (err) {
          this.errorMessage = "Network error. Try again.";
        } finally {
          this.isLoading = false;
        }
      }
      
      ,
    },
  };
  