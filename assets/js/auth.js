/**
 * Authentication Logic
 */

document.addEventListener("DOMContentLoaded", () => {
    const supabase = window.supabaseClient;

    const btnGoogle = document.getElementById("btn-google-login");
    const formEmail = document.getElementById("auth-form");

    // Google Login (Customers)
    if (btnGoogle) {
        btnGoogle.addEventListener("click", async () => {
            if (!supabase) {
                alert("يرجى إعداد بيانات Supabase أولاً");
                return;
            }

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/index.html'
                }
            });

            if (error) {
                console.error("Google Auth Error:", error);
                alert("فشل تسجيل الدخول. حاول مرة أخرى.");
            }
        });
    }

    // Email/Password Login (Stores, Drivers, Admin)
    if (formEmail) {
        formEmail.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            if (!supabase) {
                alert("يرجى إعداد بيانات Supabase أولاً");
                return;
            }

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            const submitBtn = formEmail.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = "جاري الدخول...";
            submitBtn.disabled = true;

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            submitBtn.innerText = originalText;
            submitBtn.disabled = false;

            if (error) {
                console.error("Login Error:", error);
                alert(error.message || "خطأ في البريد الإلكتروني أو كلمة المرور");
                return;
            }

            if (data.user) {
                // Fetch user role from 'users' table
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                if (userError || !userData) {
                    console.error("Failed to fetch user role:", userError);
                    alert("تعذر الوصول لبيانات المستخدم. سيتم توجيهك للصفحة الرئيسية.");
                    window.location.href = "index.html";
                    return;
                }

                // Redirect based on role
                switch (userData.role) {
                    case 'store':
                        window.location.href = "dashboard-store.html";
                        break;
                    case 'driver':
                        window.location.href = "dashboard-driver.html";
                        break;
                    case 'admin':
                        window.location.href = "dashboard-admin.html";
                        break;
                    case 'customer':
                    default:
                        window.location.href = "index.html";
                        break;
                }
            }
        });
    }

    // Helper to log out
    window.logout = async () => {
        if (supabase) {
            await supabase.auth.signOut();
            window.location.href = "login.html";
        }
    };
});
