import os
from onnx import helper, TensorProto, save_model

def create_robust_dummy_model():
    model_dir = os.path.join(os.getcwd(), "public", "models")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "drl_model.onnx")

    # Input: observation (state vector) - 20 features (typical for financial network state)
    input_info = helper.make_tensor_value_info('observation', TensorProto.FLOAT, [1, 20])
    
    # Output: action probabilities for 8 possible bailout actions
    output_info = helper.make_tensor_value_info('action_probs', TensorProto.FLOAT, [1, 8])

    # Create a simple Constant node with reasonable probabilities + Softmax simulation via Identity for demo
    constant_tensor = helper.make_tensor(
        name='const_probs',
        data_type=TensorProto.FLOAT,
        dims=[1, 8],
        vals=[0.45, 0.18, 0.12, 0.08, 0.06, 0.05, 0.04, 0.02]  # sums to ~1.0
    )

    constant_node = helper.make_node(
        'Constant',
        inputs=[],
        outputs=['raw_probs'],
        value=constant_tensor
    )

    # Identity to simulate policy output
    identity_node = helper.make_node(
        'Identity',
        inputs=['raw_probs'],
        outputs=['action_probs']
    )

    graph = helper.make_graph(
        nodes=[constant_node, identity_node],
        name='dummy_drl_bailout_policy',
        inputs=[input_info],
        outputs=[output_info],
    )

    model = helper.make_model(graph, producer_name='Buffer7-DRL-Dummy-v2')
    model.ir_version = 8
    model.opset_import[0].version = 13

    save_model(model, model_path, save_as_external_data=False)
    
    size = os.path.getsize(model_path)
    print(f"✅ Robust dummy DRL model created successfully!")
    print(f"   Location: {model_path}")
    print(f"   File size: {size} bytes")
    print(f"   This version is designed to load cleanly in onnxruntime-web.")

create_robust_dummy_model()