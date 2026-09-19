import PatientSessionGate from '@/components/patient/PatientSessionGate';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PatientSessionGate>{children}</PatientSessionGate>;
}
