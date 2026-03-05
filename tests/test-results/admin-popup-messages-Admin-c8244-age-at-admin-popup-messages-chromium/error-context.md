# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img [ref=e7]
      - heading "Welcome Back" [level=1] [ref=e10]
      - paragraph [ref=e11]: Sign in to your PARAS REWARD account
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Email / Mobile Number / UID
        - generic [ref=e15]:
          - img [ref=e16]
          - textbox "Enter email, mobile or UID" [ref=e19]
      - generic [ref=e21] [cursor=pointer]:
        - checkbox "Remember ID" [ref=e22]
        - generic [ref=e23]: Remember ID
      - button "Sign In" [ref=e24] [cursor=pointer]:
        - text: Sign In
        - img
    - paragraph [ref=e26]:
      - text: Don't have an account?
      - link "Sign Up" [ref=e27] [cursor=pointer]:
        - /url: /register
    - paragraph [ref=e28]:
      - text: By signing in, you agree to our
      - link "Terms & Conditions" [ref=e29] [cursor=pointer]:
        - /url: /terms
      - text: and
      - link "Privacy Policy" [ref=e30] [cursor=pointer]:
        - /url: /privacy
  - region "Notifications alt+T"
```