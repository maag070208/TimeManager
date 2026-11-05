import { useState } from "react";
import { EmployeeClockCard } from "@features/hr/employee-clock";
import { PersonClockPanel } from "@features/access/time-clock-people";
import { useCan } from "@entities/user";

/** Sección de reloj checador de una persona: alta, huellas y datos del reloj, todo en la misma pantalla. */
export default function EmployeeClockSection({ userId, userName }: { userId: string; userName: string }) {
  const canWrite = useCan("time_clock.write");
  const [, setNumber] = useState<string | null>(null);
  return (
    <EmployeeClockCard
      userId={userId}
      userName={userName}
      onNumber={setNumber}
      renderDetail={(serial, number, aside) => (
        <PersonClockPanel clockSerial={serial} employeeNumber={number} editable={canWrite} aside={aside} />
      )}
    />
  );
}
