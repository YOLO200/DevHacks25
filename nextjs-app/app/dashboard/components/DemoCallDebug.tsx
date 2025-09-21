"use client";

import { useState } from "react";

export default function DemoCallDebug() {
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [demoCallResult, setDemoCallResult] = useState<any>(null);

  const runTest = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/test-demo-call');
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testDemoCall = async () => {
    if (!selectedPatient) {
      alert('Please select a patient first');
      return;
    }

    setIsLoading(true);
    setDemoCallResult(null);

    try {
      const response = await fetch('/api/demo-call-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          patient_id: selectedPatient,
          reminder_id: null 
        })
      });

      const result = await response.json();
      setDemoCallResult({ 
        success: response.ok, 
        status: response.status,
        ...result 
      });
    } catch (error) {
      setDemoCallResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
      <h3 className="text-lg font-bold text-yellow-800 mb-4">
        🐛 Demo Call Debug Panel
      </h3>
      
      <div className="space-y-4">
        {/* Test System */}
        <div>
          <button
            onClick={runTest}
            disabled={isLoading}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Run System Test'}
          </button>
        </div>

        {/* Test Results */}
        {testResult && (
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="font-semibold mb-2">System Test Results:</h4>
            <pre className="text-sm bg-gray-100 text-gray-900 p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}

        {/* Patient Selection for Demo Call Test */}
        {testResult?.tests?.patients?.patients?.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Test Demo Call:</h4>
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-2"
            >
              <option value="">Select a patient...</option>
              {testResult.tests.patients.patients.map((patient: any) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} ({patient.phone})
                </option>
              ))}
            </select>
            
            <button
              onClick={testDemoCall}
              disabled={isLoading || !selectedPatient}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Testing Demo Call...' : 'Test Demo Call'}
            </button>
          </div>
        )}

        {/* Demo Call Results */}
        {demoCallResult && (
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="font-semibold mb-2">Demo Call Test Results:</h4>
            <pre className="text-sm bg-gray-100 text-gray-900 p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(demoCallResult, null, 2)}
            </pre>
          </div>
        )}

        {/* Quick Instructions */}
        <div className="text-sm text-yellow-700">
          <p><strong>Instructions:</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click "Run System Test" to check setup</li>
            <li>If test passes, select a patient and test demo call</li>
            <li>Check console logs for detailed error information</li>
            <li>Remove this component when debugging is complete</li>
          </ol>
        </div>
      </div>
    </div>
  );
}